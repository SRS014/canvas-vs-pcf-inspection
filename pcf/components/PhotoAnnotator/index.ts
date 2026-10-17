import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
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
    }
    return React.createElement(AnnotatorView, {
      src,
      marks: this.marks,
      readOnly: context.parameters.ReadOnly.raw === true,
      width: Number(context.mode.allocatedWidth) > 0 ? Number(context.mode.allocatedWidth) : 900,
      height: Number(context.mode.allocatedHeight) > 0 ? Number(context.mode.allocatedHeight) : 600,
      onChange: this.onChange,
      onImageLoad: this.onImageLoad,
    });
  }

  private onImageLoad = (img: HTMLImageElement): void => {
    this.image = img;
  };

  private onChange = (marks: Mark[]): void => {
    this.marks = marks;
    this.flattened = this.image && marks.length > 0 ? flatten(this.image, marks) : "";
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
