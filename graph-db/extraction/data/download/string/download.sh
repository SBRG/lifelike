curl -o 9606.protein.info.txt.gz https://stringdb-static.org/download/protein.info.v11.0/9606.protein.info.v11.0.txt.gz
curl -o 4932.protein.info.txt.gz https://stringdb-static.org/download/protein.info.v11.0/9606.protein.info.v11.0.txt.gz
curl -o 160488.protein.info.txt.gz https://stringdb-static.org/download/protein.info.v11.0/9606.protein.info.v11.0.txt.gz
curl -o 511145.protein.info.txt.gz https://stringdb-static.org/download/protein.info.v11.0/9606.protein.info.v11.0.txt.gz

curl -o all_organisms.refseq_2_string.tsv.gz https://string-db.org/mapping_files/refseq/all_organisms.refseq_2_string.2018.tsv.gz

# need to load the following files to link string protein refseq with ncbi genes

curl -O https://ftp.ncbi.nlm.nih.gov/gene/DATA/gene2accession.gz
curl -O https://ftp.ncbi.nlm.nih.gov/gene/DATA/gene2refseq.gz

