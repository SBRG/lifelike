// BioC is designed to allow programs that process text and
// annotations on that text to easily share data and work
// together. This DTD describes how that data is represented in XML
// files.
//
// Some believe XML is easily read by humans and that should be
// supported by clearly formatting the elements. In the long run,
// this is distracting. While the only meaningful spaces are in text
// elements and the other spaces can be ignored, current tools add no
// additional space.  Formatters and editors may be used to make the
// XML file appear more readable.
//
// The possible variety of annotations that one might want to produce
// or use is nearly countless. There is no guarantee that these are
// organized in the nice nested structure required for XML
// elements. Even if they were, it would be nice to easily ignore
// unwanted annotations.  So annotations are recorded in a stand off
// manner, external to the annotated text. The exceptions are
// passages and sentences because of their fundamental place in text.
//
// The text is expected to be encoded in Unicode, specifically
// UTF-8. This is one of the encodings required to be implemented by
// XML tools, is portable between big-endian and little-endian
// machines and is a superset of 7-bit ASCII. Code points beyond 127
// may be expressed directly in UTF-8 or indirectly using numeric
// entities.  Since many tools today still only directly process
// ASCII characters, conversion should be available and
// standardized.  Offsets should be in 8 bit code units (bytes) for
// easier processing by naive programs.

// collection:  Group of documents, usually from a larger corpus. If
// a group of documents is from several corpora, use several
// collections.
//
// <!ELEMENT collection ( source, date, key, infon*, document+ ) >
interface Collection {
  source: Source;
  date: Date;
  key: Key;
  infon: Infon;
  document: Document;
}

// source:  Name of the source corpus from which the documents were selected
//
// <!ELEMENT source (#PCDATA)>
interface Source {
  // key: Separate file describing the infons used and any other useful
  // information about the data in the file. For example, if a file
  // includes part-of-speech tags, this file should describe the set of
  // part-of-speech tags used.
  key?: Key;
  // id:  Typically, the id of the document in the parent
  // source. Should at least be unique in the collection.
  id?: Id;
}

// date:  Date documents extracted from original source. Can be as
// simple as yyyymmdd or an ISO timestamp.
//
// <!ELEMENT date (#PCDATA)>
interface Date {
  $date: string | number;
}

// <!ELEMENT key (#PCDATA)>
type Key = string;

// infon: key-value pairs. Can record essentially arbitrary
// information. "type" will be a particular common key in the major
// sub elements below. For PubMed references, passage "type" might
// signal "title" or "abstract". For annotations, it might indicate
// "noun phrase", "gene", or "disease". In the programming language
// data structures, infons are typically represented as a map from a
// string to a string.  This means keys should be unique within each
// parent element.
//
// <!ELEMENT infon (#PCDATA)>
// <!ATTLIST infon key CDATA #REQUIRED >
interface Infon {
  [key: string]: string;

  // dynamic
  journal?: string;
  year?: string;
  type?: string;
  authors?: string;
  section?: string;
  identifier?: string;
}

// document: A document in the collection. A single, complete
// stand-alone document as described by its parent source.
//
// <!ELEMENT document ( id, infon*, passage+, relation* ) >
interface Document {
  id: Id;
  infons: Infon;
  passages: Passage[];
  relations: Relation[];
  // dynamic?
  pmid?: number;
  created?: Date;
  accessions?: string[];
  journal?: string;
  year?: number;
  authors?: string[];
}


// id: Used to refer to this relation in other relations. This id
// needs to be unique at whatever level relations appear. (See
// discussion of annotation ids.)
//
// <!ELEMENT id (#PCDATA)>
type Id = string;


type Text = string;

// passage: One portion of the document.  In the sample collection of
// PubMed documents, each document has a title and frequently an
// abstract. Structured abstracts could have additional passages. For
// a full text document, passages could be sections such as
// Introduction, Materials and Methods, or Conclusion. Another option
// would be paragraphs. Passages impose a linear structure on the
// document. Further structure in the document can be described by
// infon values.
//
// <!ELEMENT passage ( infon*, offset, ( ( text?, annotation* ) | sentence* ), relation* ) >
interface Passage {
  infons: Infon;
  // offset: Where the passage occurs in the parent document. Depending
  // on the source corpus, this might be a very relevant number.  They
  // should be sequential and identify a passage's position in the
  // document.  Since the sample PubMed collection is extracted from an
  // XML file, literal offsets have little value. The title is given an
  // offset of zero, while the abstract is assumed to begin after the
  // title and one space.
  offset: number;
  // ( ( text?, annotation* ) | sentence* )?
  // text: The original text of the passage.
  text?: Text;
  annotations: Annotation[];
  sentences: Sentence[];
  relations: Relation[];
}

// sentence:  One sentence of the passage.
//
// <!ELEMENT offset (#PCDATA)>
// <!ELEMENT text (#PCDATA)>
//
// <!ELEMENT sentence ( infon*, offset, text?, annotation*, relation* ) >
interface Sentence {
  infon: Infon;
  // offset: A document offset to where the sentence begins in the
  // passage. This value is the sum of the passage offset and the local
  // offset within the passage.
  offset: number;
  // text: The original text of the sentence.
  text?: string;
  annotation: Annotation[];
  relation: Relation[];
}

// annotation:  Stand-off annotation
//
// <!ELEMENT annotation ( infon*, location*, text ) >
// <!ATTLIST annotation id CDATA #IMPLIED >
export interface Annotation {
  infons: Infon;
  locations: Location[];
  // text:  Typically the annotated text.
  text: string;
  // id: Used to refer to this annotation in relations. Should be
  // unique at whatever level relations at appear. If relations appear
  // at the sentence level, annotation ids need to be unique within
  // each sentence. Similarly, if relations appear at the passage
  // level, annotation ids need to be unique within each passage.
  id?: Id;
}

// location: Location of the annotated text. Multiple locations
// indicate a multi-span annotation.
//
// <!ELEMENT location EMPTY>
// <!ATTLIST location offset CDATA #REQUIRED >
// <!ATTLIST location length CDATA #REQUIRED >
interface Location {
  // offset: Document offset to where the annotated text begins in
  // the passage or sentence. The value is the sum of the passage or
  // sentence offset and the local offset within the passage or
  // sentence.
  offset: number;
  // length: Length of the annotated text. While unlikely, this could
  // be zero to describe an annotation that belongs between two
  // characters.
  length: number;
}

// relation: Relation between multiple annotations and / or other
// relations. Relations are allowed to appear at several levels
// (document, passage, and sentence). Typically they will all appear
// at one level, the level at which they are determined.
// Significantly different types of relations might appear at
// different levels.
//
// <!ELEMENT relation ( infon*, node* ) >
// <!ATTLIST relation id CDATA #IMPLIED >
interface Relation {
  id?: Id;
  infon: Infon[];
  node: Node[];
}

// <!ELEMENT node EMPTY>
// <!ATTLIST node refid CDATA #REQUIRED >
// <!ATTLIST node role CDATA "" >
interface Node {
  // refid: Id of an annotation or an other relation.
  refid: string;
  // role: Describes how the referenced annotattion or other relation
  // participates in the current relation. Has a default value so it
  // can be left out if there is no meaningful value.
  role: string;
}
