from cloudstorage.azure_cloud_storage import AzureCloudStorage

def azure_upload(filename: str, filepath: str):
    sas_token = AzureCloudStorage.generate_token(filename)
    cloudstorage = AzureCloudStorage(AzureCloudStorage.get_file_client(sas_token, filename))
    cloudstorage.upload(filename, filepath)
    cloudstorage.close()
