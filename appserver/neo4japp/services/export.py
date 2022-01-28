from datetime import datetime, timezone
from io import BytesIO
from typing import Dict, List
from pandas import DataFrame, ExcelWriter
from neo4japp.constants import TIMEZONE


class ExcelExportService:
    mimetype = 'application/vnd.ms-excel'

    def get_bytes(self, data: List[Dict[str, str]]) -> bytes:
        output = BytesIO()
        dataframe = DataFrame(data)
        with ExcelWriter(output, engine='xlsxwriter') as writer:
            dataframe.to_excel(writer, sheet_name='Sheet1', index=False)

            # adapt width of the columns
            worksheet = writer.sheets['Sheet1']
            for i, col in enumerate(dataframe.columns):
                column_len = dataframe[col].astype(str).str.len().max()
                column_len = max(column_len, len(col)) + 2
                worksheet.set_column(i, i, column_len)
        return output.getvalue()

    def get_filename(self, filename: str) -> str:
        return f'{filename}_{datetime.now(TIMEZONE).strftime("%Y%m%d_%H%M%S")}.xlsx'
