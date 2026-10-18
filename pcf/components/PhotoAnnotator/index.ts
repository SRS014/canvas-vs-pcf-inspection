import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { FluentProvider } from "@fluentui/react-components";
import { fusionTheme } from "../shared/theme";
import { Live, LiveStore } from "../shared/live";
import { AnnotatorView } from "./AnnotatorView";
import { Mark, flatten, parseMarks, serialiseMarks } from "./marks";

/**
 * PhotoAnnotator: numbered markers, arrows, boxes, freehand and notes on an inspection photo.
 * Outputs the photo with the marks burned in at full resolution, plus every mark as data,
 * so the annotation stays editable. Canvas passes the photo in and patches the results.
 */
export class PhotoAnnotator implements ComponentFramework.ReactControl<IInputs, IOutputs> {
  private notifyOutputChanged: () => void;
  private marks: Mark[] = [];
  private lastMarksJson: string | null = null;
  private lastSrc = "";
  private image: HTMLImageElement | null = null;
  private flattened = "";
  private src = "";
  private readOnly = false;
  private store = new LiveStore();

  public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void): void {
    this.notifyOutputChanged = notifyOutputChanged;
    context.mode.trackContainerResize(true);
  }

  public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
    const src = context.parameters.ImageDataUri.raw ?? "";
    const marksJson = context.parameters.AnnotationJson.raw ?? "";
    if (src !== this.lastSrc) {
      this.lastSrc = src;
      this.image = null;
      this.flattened = "";
    }
    // New saved marks from Canvas (another photo, or a reload) replace the local marks.
    if (marksJson !== this.lastMarksJson) {
      this.lastMarksJson = marksJson;
      this.marks = parseMarks(marksJson);
      void Promise.resolve().then(() => this.notifyOutputChanged());
    }
    this.src = src;
    this.readOnly = context.parameters.ReadOnly.raw === true;
    const live = React.createElement(Live, { store: this.store, render: this.renderView });
    return React.createElement(FluentProvider, { theme: fusionTheme, style: { background: "transparent", width: "100%", height: "100%" } }, live);
  }

  // The view fills the control's box and measures the photo area itself.
  private renderView = (): React.ReactElement =>
    React.createElement(AnnotatorView, {
      src: this.src,
      marks: this.marks,
      readOnly: this.readOnly,
      onChange: this.onChange,
      onImageLoad: this.onImageLoad,
    });

  private onImageLoad = (img: HTMLImageElement): void => {
    this.image = img;
    if (this.marks.length > 0) {
      this.flattened = flatten(img, this.marks);
      this.notifyOutputChanged();
    }
  };

  private onChange = (marks: Mark[]): void => {
    this.marks = marks;
    this.flattened = this.image && marks.length > 0 ? flatten(this.image, marks) : "";
    this.store.emit();
    this.notifyOutputChanged();
  };

  public getOutputs(): IOutputs {
    return {
      AnnotatedImageDataUri: this.flattened,
      AnnotationJsonOut: serialiseMarks(this.marks),
      MarkCount: this.marks.length,
    };
  }

  public destroy(): void {
    this.image = null;
  }
}
