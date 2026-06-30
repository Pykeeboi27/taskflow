import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider, useToast } from "@/context/ToastContext";

// ---------------------------------------------------------------------------
// Test consumer
// ---------------------------------------------------------------------------

function ToastConsumer() {
  const { toasts, addToast, removeToast } = useToast();
  return (
    <div>
      <span data-testid="count">{toasts.length}</span>
      {toasts.map((t) => (
        <div key={t.id} data-testid="toast">
          <span data-testid="toast-message">{t.message}</span>
          <span data-testid="toast-type">{t.type}</span>
          <span data-testid="toast-id">{t.id}</span>
          <button onClick={() => removeToast(t.id)}>dismiss</button>
        </div>
      ))}
      <button
        onClick={() => addToast("hello", "success")}
        data-testid="add-success"
      >
        add success
      </button>
      <button onClick={() => addToast("world")} data-testid="add-info">
        add info
      </button>
      <button
        onClick={() => addToast("error!", "error")}
        data-testid="add-error"
      >
        add error
      </button>
    </div>
  );
}

function renderToasts() {
  render(
    <ToastProvider>
      <ToastConsumer />
    </ToastProvider>,
  );
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("ToastContext", () => {
  it("starts with no toasts", () => {
    renderToasts();
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("addToast renders a toast with the given message and type", () => {
    renderToasts();
    fireEvent.click(screen.getByTestId("add-success"));

    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("toast-message")).toHaveTextContent("hello");
    expect(screen.getByTestId("toast-type")).toHaveTextContent("success");
  });

  it("addToast defaults type to 'info' when type is omitted", () => {
    renderToasts();
    fireEvent.click(screen.getByTestId("add-info"));

    expect(screen.getByTestId("toast-type")).toHaveTextContent("info");
  });

  it("addToast gives each toast a non-empty unique id", () => {
    renderToasts();
    fireEvent.click(screen.getByTestId("add-success"));
    fireEvent.click(screen.getByTestId("add-info"));

    const ids = screen
      .getAllByTestId("toast-id")
      .map((el) => el.textContent ?? "");
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("multiple toasts coexist in the list", () => {
    renderToasts();
    fireEvent.click(screen.getByTestId("add-success"));
    fireEvent.click(screen.getByTestId("add-info"));
    fireEvent.click(screen.getByTestId("add-error"));

    expect(screen.getByTestId("count")).toHaveTextContent("3");
    expect(screen.getAllByTestId("toast")).toHaveLength(3);
  });

  it("removeToast removes only the targeted toast immediately", () => {
    renderToasts();
    fireEvent.click(screen.getByTestId("add-success"));
    fireEvent.click(screen.getByTestId("add-info"));

    expect(screen.getByTestId("count")).toHaveTextContent("2");

    fireEvent.click(screen.getAllByRole("button", { name: "dismiss" })[0]);

    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });

  it("auto-dismisses a toast after 4 000 ms", () => {
    vi.useFakeTimers();
    try {
      renderToasts();
      fireEvent.click(screen.getByTestId("add-success"));

      expect(screen.getByTestId("count")).toHaveTextContent("1");

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(screen.getByTestId("count")).toHaveTextContent("0");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not auto-dismiss before 4 000 ms have elapsed", () => {
    vi.useFakeTimers();
    try {
      renderToasts();
      fireEvent.click(screen.getByTestId("add-success"));

      act(() => {
        vi.advanceTimersByTime(3999);
      });

      expect(screen.getByTestId("count")).toHaveTextContent("1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("useToast throws when called outside ToastProvider", () => {
    function BadConsumer() {
      useToast();
      return null;
    }
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    expect(() => render(<BadConsumer />)).toThrow(
      "useToast must be used within ToastProvider",
    );
    consoleSpy.mockRestore();
  });
});
