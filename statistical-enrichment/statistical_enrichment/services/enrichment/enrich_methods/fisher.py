import numpy as np
import pandas as pd
from scipy.stats.distributions import hypergeom
from statsmodels.stats.multitest import fdrcorrection


def add_q_value(df, related_go_terms_count, inplace=True):
    p_values = df["p-value"]
    extended_p_values = p_values.append(
        pd.Series(np.ones(related_go_terms_count - len(p_values)))
    )
    r = fdrcorrection(extended_p_values, method="indep")
    if inplace:
        df["rejected"] = r[0][: len(p_values)]
        df["q-value"] = r[1][: len(p_values)]
    else:
        return r


def fisher_p(k, M, n, N):
    """
    :param k: drawn type I objects
    :param M: total number of objects
    :param n: total number of type I objects
    :param N: draws without replacement
    :return: p
    """
    # return fisher_exact([[k, n-k], [N-k, M-(N+n-k)]], "greater")[1]
    # equivalent to using scipy.stats.fisher_exact:
    return hypergeom.cdf(n - k, M, n, M - N)


def fisher(geneNames, GOterms, related_go_terms_count):
    """
    Run standard fisher's exact tests for each annotation term.
    """
    df = pd.DataFrame(GOterms)
    query = pd.unique(geneNames)
    M = df["geneNames"].explode().nunique()
    N = len(query)

    def f(go):
        matching_gene_names = list(set(go["geneNames"]).intersection(query))
        go["p-value"] = fisher_p(len(matching_gene_names), M, len(go["geneNames"]), N)
        go["gene"] = f"{go['goTerm']} ({go['goId']})"
        go["geneNames"] = matching_gene_names
        return go

    df = df.apply(f, axis=1).sort_values(by="p-value")

    add_q_value(df, related_go_terms_count)
    return df.to_json(orient="records")
