from neo4japp.database import db
from neo4japp.models.common import RDBMSBase


class DomainURLsMap(RDBMSBase):
    """
    This model stores the relation between knowledge domains and its base URLs
    """
    __tablename__ = 'domain_urls_map'
    id = db.Column(db.Integer, primary_key=True)
    domain = db.Column(db.String(128), nullable=False)
    base_URL = db.Column(db.String(256), nullable=False)


class AnnotationStyle(RDBMSBase):
    """
    This model stores the styles related to each entity type
    """
    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(32), nullable=False)
    color = db.Column(db.String(9), nullable=False)
    icon_code = db.Column(db.String(32), nullable=True)
    font_color = db.Column(db.String(9), nullable=True)
    border_color = db.Column(db.String(9), nullable=True)
    background_color = db.Column(db.String(9), nullable=True)

    def get_as_json(self):
        return {
            'label': self.label,
            'color': self.color,
            'icon_code': self.icon_code,
            'style': {
                'border': self.border_color,
                'background': self.background_color,
                'color': self.font_color
            }
        }
