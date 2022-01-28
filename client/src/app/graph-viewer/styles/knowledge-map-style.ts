import {
  DETAIL_NODE_LABELS, Hyperlink, Source,
  UniversalEdgeStyle,
  UniversalGraphEdge,
  UniversalGraphNode,
  UniversalNodeStyle,
} from 'app/drawing-tool/services/interfaces';
import {
  EdgeRenderStyle,
  NodeRenderStyle,
  PlacedEdge,
  PlacedNode,
  PlacementOptions,
} from 'app/graph-viewer/styles/styles';
import { nullCoalesce, nullIfEmpty } from 'app/shared/utils/types';
import { RectangleNode } from 'app/graph-viewer/utils/canvas/graph-nodes/rectangle-node';
import { TextAlignment, TextElement } from 'app/graph-viewer/utils/canvas/text-element';
import { FontIconNode } from 'app/graph-viewer/utils/canvas/graph-nodes/font-icon-node';
import { AnnotationStyle, annotationTypesMap } from 'app/shared/annotation-styles';
import { LineEdge } from 'app/graph-viewer/utils/canvas/graph-edges/line-edge';
import { LINE_HEAD_TYPES, LineHeadType } from 'app/drawing-tool/services/line-head-types';
import {FA_CUSTOM_ICONS, CustomIconColors, Unicodes} from 'app/shared/constants';
import {getSupportedFileCodes} from 'app/shared/utils';

import { Arrowhead } from '../utils/canvas/line-heads/arrow';
import { DiamondHead } from '../utils/canvas/line-heads/diamond';
import { LineHead } from '../utils/canvas/line-heads/line-heads';
import { CircleHead } from '../utils/canvas/line-heads/circle';
import { CrossAxisLineHead } from '../utils/canvas/line-heads/cross-axis';
import { EmptyLineHead } from '../utils/canvas/line-heads/empty';
import { CompoundLineHead } from '../utils/canvas/line-heads/compound';
import { RectangleHead } from '../utils/canvas/line-heads/rectangle';
import { Line } from '../utils/canvas/lines/lines';
import { SolidLine } from '../utils/canvas/lines/solid';
import { DashedLine } from '../utils/canvas/lines/dashed';
import { ResourceManager } from '../utils/resource/resource-manager';
import { ImageNode } from '../utils/canvas/graph-nodes/image-node';


/**
 * Implements the style used on the Knowledge Graph.
 */
export class KnowledgeMapStyle implements NodeRenderStyle, EdgeRenderStyle {
  private readonly font = 'Roboto, "Helvetica Neue", sans-serif';
  private readonly defaultSourceLineEndDescriptor: string = null;
  private readonly defaultTargetLineEndDescriptor = 'arrow';
  private readonly lineEndBaseSize = 16;
  private readonly maxWidthIfUnsized = 400;
  private readonly maxIconNodeWidthIfUnsized = 200;
  private readonly maxHeightIfUnsized = 400;
  private readonly detailTypeBackgrounds = new Map([
    ['note', '#FFF6D5'],
    ['link', '#DCF1F1'],
  ]);

  constructor(protected readonly imageManager: ResourceManager<string, CanvasImageSource>) {
  }

  placeNode(d: UniversalGraphNode, ctx: CanvasRenderingContext2D, placementOptions: PlacementOptions): PlacedNode {
    const styleData: UniversalNodeStyle = nullCoalesce(d.style, {});
    const labelFontSizeScale = nullCoalesce(styleData.fontSizeScale, 1);
    const labelFont = (16 * labelFontSizeScale) + 'px ' + this.font;
    const forceHighDetailLevel = placementOptions.selected || placementOptions.highlighted;

    let textColor = '#000';
    let bgColor = '#fff';
    let strokeColor = '#2B7CE9';
    let iconCode = null;

    // Pull style from the annotation types map
    const annotationStyle: AnnotationStyle = annotationTypesMap.get(d.label);

    if (annotationStyle) {
      if (annotationStyle.iconCode) {
        iconCode = annotationStyle.iconCode;
      }
    }

    if (styleData.fillColor != null) {
      textColor = styleData.fillColor;
    } else if (annotationStyle) {
      if (annotationStyle.color) {
        textColor = annotationStyle.color;
      }
      if (annotationStyle.style) {
        if (annotationStyle.style.background) {
          bgColor = annotationStyle.style.background;
        }
        if (annotationStyle.style.color) {
          textColor = annotationStyle.style.color;
        }
        if (annotationStyle.style.border) {
          strokeColor = annotationStyle.style.border;
        }
      }
    }

    if (styleData.strokeColor != null) {
      strokeColor = styleData.strokeColor;
    }

    if (DETAIL_NODE_LABELS.has(d.label) && styleData.showDetail) {
      // ---------------------------------
      // Note WITH detail
      // ---------------------------------

      const textbox = new TextElement(ctx, {
        width: d.data.width,
        height: d.data.height,
        maxWidth: !d.data.width ? this.maxWidthIfUnsized : null,
        maxHeight: !d.data.height ? this.maxHeightIfUnsized : null,
        text: d.data.detail != null ? d.data.detail : '',
        font: labelFont,
        fillStyle: nullCoalesce(styleData.fillColor, '#000'),
        horizontalAlign: TextAlignment.Start,
        verticalAlign: TextAlignment.Start,
        topInset: 5,
        leftInset: 5,
        bottomInset: 5,
        rightInset: 5,
      });

      return new RectangleNode(ctx, {
        x: d.data.x,
        y: d.data.y,
        width: nullCoalesce(d.data.width, textbox.actualWidthWithInsets),
        height: nullCoalesce(d.data.height, textbox.actualHeightWithInsets),
        textbox,
        stroke: this.createLine(
          nullCoalesce(styleData.lineType, 'solid'),
          nullCoalesce(styleData.lineWidthScale, 1) *
          (placementOptions.selected || placementOptions.highlighted ? 1.3 : 1),
          nullCoalesce(styleData.strokeColor, this.detailTypeBackgrounds.get(d.label)),
        ),
        shapeFillColor: this.detailTypeBackgrounds.get(d.label),
        forceHighDetailLevel,
      });

    } else if (iconCode) {
      // ---------------------------------
      // Generic icon node + Note
      // ---------------------------------
      let specialIconColor: string;

      // Override icon for link types
      if (d.label === 'link') {
        const links: (Source | Hyperlink)[] = [
          ...(d.data && d.data.sources ? d.data.sources : []),
          ...(d.data && d.data.hyperlinks ? d.data.hyperlinks : []),
        ];

        for (const link of links) {
          try {
            const url = new URL(link.url, window.location.href);
            if (url.pathname.match(/^\/projects\/([^\/]+)\/bioc\//)) {
              iconCode = Unicodes.BioC;
              break;
            } else if (url.pathname.match(/^\/projects\/([^\/]+)\/enrichment-table\//)) {
              iconCode = Unicodes.EnrichmentTable;
              break;
            } else if (url.pathname.match(/^\/projects\/([^\/]+)\/maps\//)) {
              iconCode = Unicodes.Map;
              break;
            } else if (url.pathname.match(/^\/projects\/([^\/]+)\/sankey\//)) {
              iconCode = Unicodes.Graph;
              break;
            } else if (url.pathname.match(/^\/projects\/([^\/]+)\/files\//)) {
              iconCode = Unicodes.Pdf;
              break;
            } else if (url.pathname.match(/^\/projects\/([^\/]+)\/?$/)) {
              iconCode = Unicodes.Project;
              break;
            } else if (url.protocol.match(/^mailto:$/i)) {
              iconCode = Unicodes.Mail;
              break;
            } else if (url.pathname.match(/^\/files\//)) {
              const domain = link.domain.trim();
              const matchedIcon = getSupportedFileCodes(domain);
              if (matchedIcon !== undefined) {
                iconCode = matchedIcon.unicode;
                specialIconColor = matchedIcon.color;
              }
            }
          } catch (e) {
          }
        }
      }
      let iconTextColor = nullCoalesce(d.icon ? d.icon.color : null, textColor);
      if (specialIconColor && !styleData.fillColor) {
        iconTextColor = specialIconColor;
      }
      const iconLabelColor = nullCoalesce(specialIconColor, iconTextColor);
      const iconSize = nullCoalesce(d.icon ? d.icon.size : null, 50);
      // Change font family to custom kit if icon is customly added
      const fontAwesomeFont = FA_CUSTOM_ICONS.includes(iconCode) ? '"Font Awesome Kit"' : '"Font Awesome 5 Pro';
      const iconFontFace = nullCoalesce(d.icon ? d.icon.face : null, fontAwesomeFont);
      const iconFont = `${iconSize}px ${iconFontFace}`;

      // Textbox to draw the icon
      const iconTextbox = new TextElement(ctx, {
        text: nullCoalesce(iconCode, '?'),
        font: iconFont,
        fillStyle: iconLabelColor,
      });

      // Textbox for the label below the icon
      const labelTextbox = new TextElement(ctx, {
        maxWidth: this.maxIconNodeWidthIfUnsized,
        text: d.display_name,
        font: labelFont,
        fillStyle: iconTextColor,
        horizontalAlign: TextAlignment.Center,
      });

      return new FontIconNode(ctx, {
        x: d.data.x,
        y: d.data.y,
        iconTextbox,
        labelTextbox,
        forceHighDetailLevel,
      });

    } else if (d.image_id) {
      // ---------------------------------
      // Image nodes
      // ---------------------------------
        const width = nullCoalesce(d.data.width, 100);
        const labelTextbox = new TextElement(ctx, {
        // Max width of label is equal to the width of the image
        maxWidth: width,
        text: d.display_name,
        font: labelFont,
        fillStyle: nullCoalesce(d.style ? d.style.fillColor : null, textColor),
        horizontalAlign: TextAlignment.Center,
        });

        return new ImageNode(ctx, {
          x: d.data.x,
          y: d.data.y,
          width,
          height: nullCoalesce(d.data.height, 100),
          imageManager: this.imageManager,
          imageId: d.image_id,
          stroke: this.createLine(
            nullCoalesce(styleData.lineType, 'blank'),
            nullCoalesce(styleData.lineWidthScale, 1),
            nullCoalesce(styleData.strokeColor, 'white'),
          ),
          textbox: labelTextbox
        });

    } else {
      // ---------------------------------
      // All other nodes
      // ---------------------------------

      // The text content of the node
      const textbox = new TextElement(ctx, {
        width: d.data.width,
        maxWidth: d.data.width ? null : this.maxWidthIfUnsized,
        height: d.data.height,
        maxHeight: d.data.height ? null : this.maxHeightIfUnsized,
        text: d.display_name,
        font: labelFont,
        fillStyle: textColor,
      });

      return new RectangleNode(ctx, {
        x: d.data.x,
        y: d.data.y,
        width: nullCoalesce(d.data.width, textbox.actualWidth),
        height: nullCoalesce(d.data.height, textbox.actualHeight),
        textbox,
        stroke: this.createLine(
          nullCoalesce(styleData.lineType, 'solid'),
          nullCoalesce(styleData.lineWidthScale, 1),
          strokeColor,
        ),
        shapeFillColor: bgColor,
        forceHighDetailLevel,
      });
    }
  }

  placeEdge(d: UniversalGraphEdge,
            from: UniversalGraphNode,
            to: UniversalGraphNode,
            placedFrom: PlacedNode,
            placedTo: PlacedNode,
            ctx: CanvasRenderingContext2D,
            placementOptions: PlacementOptions): PlacedEdge {
    const connectedToNotes = DETAIL_NODE_LABELS.has(from.label) || DETAIL_NODE_LABELS.has(to.label);
    const styleData: UniversalEdgeStyle = nullCoalesce(d.style, {});
    const fontSizeScale = nullCoalesce(styleData.fontSizeScale, 1);
    const strokeColor = nullCoalesce(styleData.strokeColor, '#2B7CE9');
    const lineType = nullCoalesce(styleData.lineType, connectedToNotes ? 'dashed' : 'solid');
    // noinspection UnnecessaryLocalVariableJS
    const lineWidthScale = nullCoalesce(styleData.lineWidthScale, 1);
    const lineWidth = lineWidthScale;
    const sourceHeadType = styleData.sourceHeadType;
    const targetHeadType = styleData.targetHeadType;

    // Find where the line intersects with the source and target nodes
    // TODO: Consider using the 'closest point to bbox' instead of intersection point
    const [toX, toY] = placedTo.lineIntersectionPoint(from.data.x, from.data.y);
    const [fromX, fromY] = placedFrom.lineIntersectionPoint(to.data.x, to.data.y);

    // Arrow/whatever at the beginning of the line
    const sourceLineEnd = this.createHead(
      nullIfEmpty(sourceHeadType),
      lineWidth,
      strokeColor,
      this.defaultSourceLineEndDescriptor,
    );

    // Arrow/whatever at the end of the line
    const targetLineEnd = this.createHead(
      nullIfEmpty(targetHeadType),
      lineWidth,
      strokeColor,
      connectedToNotes ? null : this.defaultTargetLineEndDescriptor,
    );

    // Label textbox, if any
    const textbox = d.label ? new TextElement(ctx, {
      text: d.label,
      font: (placementOptions.highlighted ? 'bold ' : '') + (16 * fontSizeScale) + 'px ' + this.font,
      fillStyle: '#444',
      strokeStyle: '#fff',
      strokeWidth: 3,
    }) : null;

    return new LineEdge(ctx, {
      source: {
        x: fromX,
        y: fromY,
      },
      target: {
        x: toX,
        y: toY,
      },
      textbox,
      sourceLineEnd,
      targetLineEnd,
      stroke: this.createLine(
        lineType,
        lineWidth,
        strokeColor,
      ),
      forceHighDetailLevel: placementOptions.selected || placementOptions.highlighted,
    });
  }

  /**
   * Generate a line object (if any) based on the parameters.
   * @param type the type of line
   * @param width the width of the line
   * @param style the color style
   */
  private createLine(type: string | undefined,
                     width: number,
                     style: string): Line | undefined {
    if (type == null) {
      return null;
    }

    if (type === 'none') {
      return null;
    } else if (type === 'dashed') {
      return new DashedLine(width, style, [10, 10]);
    } else if (type === 'long-dashed') {
      return new DashedLine(width, style, [25, 10]);
    } else if (type === 'dotted') {
      return new DashedLine(width, style, [1, 2]);
    } else if (type === 'two-dashed') {
      return new DashedLine(width, style, [4, 8, 20, 8]);
    } else {
      return new SolidLine(width, style);
    }
  }

  /**
   * Generate a line head object (if any) based on the parameters.
   * @param type the type of head
   * @param lineWidth the width of the line
   * @param strokeColor the stroke color
   * @param defaultType the default fallback type
   */
  private createHead(type: string | undefined,
                     lineWidth: number,
                     strokeColor: string,
                     defaultType: string | undefined = null): LineHead | undefined {
    const effectiveType = nullCoalesce(nullIfEmpty(type), nullIfEmpty(defaultType));

    if (effectiveType == null) {
      return null;
    }

    let descriptor;
    const lineHeadType: LineHeadType = LINE_HEAD_TYPES.get(effectiveType);
    if (lineHeadType) {
      descriptor = lineHeadType.descriptor;
    } else {
      return null;
    }

    if (descriptor === 'none') {
      return null;
    }

    return new CompoundLineHead(
      descriptor.split(',').map(token => {
        switch (token) {
          case 'spacer':
            return [
              new EmptyLineHead(this.lineEndBaseSize * 0.3),
            ];
          case 'cross-axis':
            return [
              new EmptyLineHead(this.lineEndBaseSize * 0.3),
              new CrossAxisLineHead(this.lineEndBaseSize, {
                fillStyle: strokeColor,
                strokeStyle: strokeColor,
              }),
            ];
          case 'circle':
            return [
              new CircleHead(
                this.lineEndBaseSize + lineWidth, {
                  fillStyle: strokeColor,
                  strokeStyle: null,
                }),
            ];
          case 'diamond':
            return [
              new DiamondHead(
                this.lineEndBaseSize + lineWidth,
                this.lineEndBaseSize + lineWidth, {
                  fillStyle: strokeColor,
                  strokeStyle: null,
                }),
            ];
          case 'square':
            return [
              new RectangleHead(
                this.lineEndBaseSize + lineWidth,
                this.lineEndBaseSize + lineWidth, {
                  fillStyle: strokeColor,
                  strokeStyle: null,
                }),
            ];
          default:
            return [new Arrowhead(
              this.lineEndBaseSize + lineWidth, {
                fillStyle: strokeColor,
                strokeStyle: null,
                length: this.lineEndBaseSize,
                lineWidth,
              })];
        }
      }).reduce((compound, lineEnds) => {
        for (const lineEnd of lineEnds) {
          compound.push(lineEnd);
        }
        return compound;
      }, []),
    );
  }
}
