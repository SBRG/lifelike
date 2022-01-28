import { escapeRegExp } from 'lodash-es';

import { EnrichmentTableViewerComponent } from 'app/enrichment/components/table/enrichment-table-viewer.component';
import { FileViewComponent } from 'app/pdf-viewer/components/file-view.component';
import { BiocViewComponent } from 'app/bioc-viewer/components/bioc-view.component';

import { WorkspaceManager } from '../workspace-manager';

/**
 * Create a valid url string suitable for <a> tag href usage.
 * @param url - user provided string that might need enhancement - such as adding http:// for external links
 */
export function toValidLink(url: string): string {
  url = url.trim();
  // Watch out for javascript:!
  if (url.match(/^(http|ftp)s?:\/\//i)) {
    return url;
  } else if (url.match(/^\/\//i)) {
    return 'http:' + url;
    // Internal URL begins with single /
  } else if (url.startsWith('/')) {
    return url;
  } else if (url.match(/^mailto:/i)) {
    return url;
  } else {
    return 'http://' + url;
  }
}

/**
 * Returns the string as a valid URL object
 * @param url - user provided string with url
 */

export function toValidUrl(url: string): URL {
  // Create a valid href string
  url = toValidLink(url);
  let urlObject;
  try {
    // This will fail in case of internal URL
    urlObject = new URL(url);
  } catch (e) {
    if (url.startsWith('/')) {
      urlObject = new URL(url, window.location.href);
    } else {
      urlObject = new URL('https://' + url);
    }
  }
  return urlObject;
}

/**
 * Open a link given by the URL. Handles mailto: and poorly formatted URLs.
 * @param url the URL
 * @param target the window target (default _blank)
 */
export function openLink(url: string, target = '_blank'): boolean {
  if (url == null) {
    return false;
  }

  url = toValidLink(url);
  window.open(url, target);

  return true;
}

export function openPotentialInternalLink(workspaceManager: WorkspaceManager,
                                          url: string): boolean {
  const urlObject = toValidUrl(url);
  const openInternally = workspaceManager.isWithinWorkspace()
    && (window.location.hostname === urlObject.hostname
      && (window.location.port || '80') === (urlObject.port || '80'));
  const pathSearchHash: string = urlObject.pathname + urlObject.search + urlObject.hash;

  if (openInternally) {
    let m;

    // TODO: Folder tabs have a slightly different URL structure than other files for some reason, so we need to check for them manually.
    // You can verify this behavior by opening a folder and a file in the workspace and clicking the "Share" button in the tab options
    // for each.
    m = pathSearchHash.match(/^\/projects\/[^\/]+\/folders\/([^\/#?]+)/);
    if (m != null) {
      workspaceManager.navigateByUrl({
        url: pathSearchHash,
        extras: {
          newTab: true,
          sideBySide: true,
          matchExistingTab: `^/+folders/${escapeRegExp(m[2])}.*`,
        }
      });

      return true;
    }

    m = pathSearchHash.match(/^\/projects\/[^\/]+\/([^\/]+)\/([^\/#?]+)/);
    if (m != null) {
      workspaceManager.navigateByUrl({
        url: pathSearchHash,
        extras: {
          newTab: true,
          sideBySide: true,
          matchExistingTab: `^/+projects/[^/]+/([^/]+)/${escapeRegExp(m[2])}.*`,
          shouldReplaceTab: component => {
            if (m[1] === 'files') {
              const fileViewComponent = component as FileViewComponent;
              const fragmentMatch = url.match(/^[^#]+#(.+)$/);
              if (fragmentMatch) {
                fileViewComponent.scrollInPdf(fileViewComponent.parseLocationFromUrl(fragmentMatch[1]));
              }
            } else if (m[1] === 'enrichment-table') {
              const enrichmentTableViewerComponent = component as EnrichmentTableViewerComponent;
              const fragmentMatch = url.match(/^[^#]+#(.+)$/);
              if (fragmentMatch) {
                enrichmentTableViewerComponent.annotation = enrichmentTableViewerComponent.parseAnnotationFromUrl(fragmentMatch[1]);
                enrichmentTableViewerComponent.startAnnotationFind(
                  enrichmentTableViewerComponent.annotation.id,
                  enrichmentTableViewerComponent.annotation.text,
                  enrichmentTableViewerComponent.annotation.color
                );
              }

              return false;
            } else if (m[1] === 'bioc') {
              const fragmentMatch = url.match(/^[^#]+#(.+)$/);
              const biocViewComponent = component as BiocViewComponent;
              if (fragmentMatch && fragmentMatch[1]) {
                (biocViewComponent).scrollInOffset(biocViewComponent.parseLocationFromUrl(fragmentMatch[1]));
              }
            }
            return false;
          },
        }
      });
      return true;
    }

    m = pathSearchHash.match(/^\/projects\/([^\/]+)/);
    if (m != null) {
      workspaceManager.navigateByUrl({
        url: pathSearchHash,
        extras: {
          newTab: true,
          sideBySide: true,
          // Need the regex end character here so we don't accidentally match a child of this directory
          matchExistingTab: `^/+projects/${escapeRegExp(m[1])}\\?$`,
        }
      });

      return true;
    }

    m = pathSearchHash.match(/^\/dt\/pdf/);
    if (m != null) {
      const [
        fileId,
        page,
        coordA,
        coordB,
        coordC,
        coordD,
      ] = pathSearchHash.replace(/^\/dt\/pdf\//, '').split('/');
      const newUrl = `/projects/beta-project/files/${fileId}#page=${page}&coords=${coordA},${coordB},${coordC},${coordD}`;
      workspaceManager.navigateByUrl({
        url: newUrl,
        extras: {
          newTab: true,
          sideBySide: true,
          matchExistingTab: `^/projects/beta-project/files/${fileId}`,
        }
      });

      return true;
    }

    m = pathSearchHash.match(/^\/dt\/map\/([0-9a-f]+)$/);
    if (m != null) {
      workspaceManager.navigateByUrl({
        url: `/dt/map/${m[1]}`,
        extras: {
          newTab: true,
          sideBySide: true,
          matchExistingTab: `/maps/${m[1]}`,
        }
      });

      return true;
    }
  }

  return openLink(urlObject.href, '_blank');
}


const DOMAIN_MAP = new Map([
  [/^((https|http)(:\/\/))?(www.)?ncbi.nlm.nih.gov\/gene\/.+$/, 'NCBI Gene'],
  [/^((https|http)(:\/\/))?(www.)?ncbi.nlm.nih.gov\/Taxonomy\/.+$/, 'NCBI Taxonomy'],
  [/^((https|http)(:\/\/))?(www.)?ncbi.nlm.nih.gov\/mesh\/.+$/, 'MeSH'],
  [/^((https|http)(:\/\/))?(www.)?ebi.ac.uk\/.+$/, 'ChEBI'],
  [/^((https|http)(:\/\/))?(www.)?uniprot.org\/.+$/, 'UniProt'],
  [/^((https|http)(:\/\/))?(www.)?amigo.geneontology.org\/.+$/, 'GO'],
  [/^((https|http)(:\/\/))?(www.)?pubchem.ncbi.nlm.nih.gov\/.+$/, 'PubChem'],
  [/^((https|http)(:\/\/))?(www.)?biocyc.org\/.+$/, 'BioCyc'],
]);

// Match the url address with the domain
export function parseURLToDomainName(url: string, defaultReturn?: string): string {
   for (const [re, val] of DOMAIN_MAP.entries()) {
    if (re.exec(url)) {
      return val;
    }
   }
   return defaultReturn || 'Link';
}
