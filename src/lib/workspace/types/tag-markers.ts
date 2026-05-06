export interface TagMarker {
  /** CSS selector path to the tagged element (built by the in-iframe tagger). */
  selector: string;
  /** Short preview of the element's textContent (truncated by the tagger). */
  text: string;
}
