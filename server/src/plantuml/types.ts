export interface ValidationError {
  message: string;
  /** 1-indexed line in the submitted source, when the engine reports one. */
  line: number | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface RenderResult {
  /** Absolute path of the written PNG. */
  pngPath: string;
  bytes: number;
}

export interface PlantUmlBackend {
  readonly name: 'jar' | 'server';
  /** Checks syntax without producing an image. */
  verify(source: string): Promise<ValidationResult>;
  /** Renders to PNG at `outPath`. Only called on sources that already verified. */
  render(source: string, outPath: string): Promise<RenderResult>;
  /**
   * Renders to SVG and returns the markup itself rather than writing a file.
   *
   * The API embeds SVG directly in its responses so the browser has something
   * to show without a second round trip, and so diagrams stay sharp at any
   * zoom. Only called on sources that already verified.
   */
  renderSvg(source: string): Promise<string>;
  /** Confirms the backend is reachable/usable; used at boot and in tests. */
  available(): Promise<boolean>;
}
