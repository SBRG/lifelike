## Running NLP Training

1. Run `docker exec appserver python neo4japp/services/annotations/nlp_data_output/produce_nlp_training.py`
2. Run `docker exec appserver python neo4japp/services/annotations/nlp_data_output/move.py`
    - This updates the `data-1602546717626.csv` file with what still needs to be processed

NOTE: After every batch run, clear out `errors.txt` and `processed_records.txt`.
