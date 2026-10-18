// Re-render a virtual control's view when its own state changes.
// In Canvas, updateView runs only when an input or the size changes, not after notifyOutputChanged,
// so a click that changes answers or marks must re-render the view itself.
import * as React from "react";

export class LiveStore {
  private listeners = new Set<() => void>();

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public emit(): void {
    this.listeners.forEach((l) => l());
  }
}

export interface LiveProps {
  store: LiveStore;
  render: () => React.ReactElement;
}

/** Calls render() on every updateView and on every store.emit(). */
export const Live: React.FC<LiveProps> = ({ store, render }) => {
  const [, setTick] = React.useState(0);
  React.useEffect(() => store.subscribe(() => setTick((t) => t + 1)), [store]);
  return render();
};
