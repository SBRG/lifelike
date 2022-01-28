from dataclasses import dataclass

from flask_marshmallow import Schema
from marshmallow import fields, ValidationError
from marshmallow.validate import Regexp, OneOf


@dataclass
class Organism:
    id: int
    name: str

    def __str__(self):
        return f"{self.id}/{self.name}"


class OrganismField(fields.Field):
    validators = [Regexp(r"\d+/.+")]
    default_error_messages = {
        "required": "Missing data for required field.",
        "null": "Field may not be null.",
        "validator_failed": "Organism must be defined as 'taxID/name'.",
    }

    def _serialize(self, value, attr, obj, **kwargs):
        return str(value)

    def _deserialize(self, value, attr, data, **kwargs):
        try:
            return Organism(*value.split("/"))
        except ValueError as error:
            raise ValidationError(
                "Organism field must be filled as taxID/name"
            ) from error


class GeneOrganismSchema(Schema):
    geneNames = fields.List(fields.Str)
    organism = OrganismField()


class EnrichmentSchema(GeneOrganismSchema):
    analysis = fields.Str(validate=OneOf(["fisher"]))
