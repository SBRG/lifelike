import numpy as np
import pandas as pd
from scipy.stats.distributions import binom

from .fisher import fisher_p


def fisher(geneNames, GOterms):
    """
    Run standard fisher's exact tests for each annotation term.
    """
    go = pd.DataFrame(GOterms)

    df = go.drop_duplicates(["geneName", "goId"])
    query = pd.unique(geneNames)
    df["query"] = np.in1d(df["geneName"], query).astype(float)
    M = df["geneName"].nunique()
    N = len(query)

    df = df.groupby("goId").agg(
        p_value=("query", lambda q: fisher_p(q.sum(), M, len(q), N)),
        geneNames=("geneName", lambda gn: list(gn[np.in1d(gn, query)])),
        goTerm=("goTerm", "first"),
        goLabel=("goLabel", "first"),
    )

    df = df[df["p_value"] < 1].sort_values(by="p_value")
    df = df.reset_index().rename(columns={"p_value": "p-value"})
    df["gene"] = df.apply(lambda m: f"{m['goTerm']} ({m['goId']})", axis=1)

    return df.to_json(orient="records")


def binom_p(x, n, N, M):
    """
    Get a p-value from a binomial test.
    :param x: number of successful trials
    :param n: number of trials
    :param N: number of objects that if selected is considered a successful trial
    :param M: total number of objects to select
    :return: float p-value
    """
    # equivalent to using scipy.stats.binom_test
    return binom.sf(x - 1, n, N / M)


def binom_main(query, counts, ids, annotations):
    """
    Run standard fisher's exact tests for each annotation term.
    :param query: list of entity ids,
        e.g. NCBI entrez gene IDs. Must match ids in "ids" exactly.
    :param counts: number of repeated observations for each of the ids in "query".
    :param ids: list of ids for each annotation in "annotations"
    :param annotations: list of annotations for each id in "ids",
        e.g. GO terms, MeSH disease terms.
    :return: vector of unique annotation terms, vector of p-values
    """
    M = len(pd.unique(ids))
    n = sum(counts)

    df = (
        pd.DataFrame({"id": ids, "annotation": annotations})
        .drop_duplicates()
        .set_index("id")
    )
    df = (
        pd.DataFrame({"id": query, "count": counts})
        .groupby("id")
        .sum()
        .join(df, how="right")
        .reset_index()
    )
    df = df.groupby("annotation").apply(
        lambda g: binom_p(g["count"].sum(), n, g["id"].nunique(), M)
    )

    return list(df.index), list(df)


def binomial(geneNames, GOterms):
    go = pd.DataFrame(GOterms)
    goGenes = go["geneName"]
    goId = go["goId"]
    gene, p = binom_main(geneNames, list(map(lambda g: 1, geneNames)), goGenes, goId)
    r = list(map(lambda gp: {"gene": gp[0], "p-value": -np.log10(gp[1])}, zip(gene, p)))
    return r
