import React from "react";

type Props = {
  children: React.ReactNode;
  onClose?: () => void;
};

type State = {
  hasError: boolean;
  errorMessage?: string;
};

export class AssistantErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown) {
    // Log for debugging without crashing the entire app
    console.error("[AssistantPanel] render error:", error);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full p-6 flex flex-col justify-center items-center text-center">
          <p className="text-sm font-semibold text-foreground mb-2">OMNI is temporarily unavailable</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Something went wrong while loading the assistant panel.
          </p>
          {this.state.errorMessage && (
            <p className="text-[11px] text-muted-foreground mt-2 break-all">{this.state.errorMessage}</p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={this.handleReset}
              className="text-xs px-3 py-1 rounded-md border border-border hover-elevate"
            >
              Retry
            </button>
            {this.props.onClose && (
              <button
                onClick={this.props.onClose}
                className="text-xs px-3 py-1 rounded-md border border-border hover-elevate"
              >
                Close
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
