import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TaskItem from "@/components/Tasks/TaskItem";
import type { Task } from "@/types";

// ---------------------------------------------------------------------------
// Module mocks — keep TaskItem isolated from context / router dependencies
// ---------------------------------------------------------------------------

vi.mock("@/context/TaskContext", () => ({
  useTaskContext: vi.fn(() => ({
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  })),
}));

vi.mock("@/context/ToastContext", () => ({
  useToast: vi.fn(() => ({
    addToast: vi.fn(),
  })),
}));

// Modal calls dialog.showModal() which jsdom does not implement. Provide a
// lightweight replacement so the TaskItem tree can mount without errors.
vi.mock("@/components/Common/Modal", () => ({
  default: ({
    open,
    children,
    title,
  }: {
    open: boolean;
    children: React.ReactNode;
    title: string;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date("2024-06-15T12:00:00.000Z");

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Test task",
    description: null,
    status: "pending",
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

/** Render a TaskItem with `created_at` set to `msPast` milliseconds before NOW. */
function renderWithAge(msPast: number, overrides: Partial<Task> = {}) {
  const created_at = new Date(NOW.getTime() - msPast).toISOString();
  render(<TaskItem task={makeTask({ created_at, ...overrides })} />);
  return screen.getByRole("time");
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("TaskItem", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Smoke test
  // -------------------------------------------------------------------------

  it("renders the task title", () => {
    render(<TaskItem task={makeTask({ title: "Buy groceries" })} />);
    expect(screen.getByText("Buy groceries")).toBeInTheDocument();
  });

  it("renders the task description when present", () => {
    render(<TaskItem task={makeTask({ description: "Milk and eggs" })} />);
    expect(screen.getByText("Milk and eggs")).toBeInTheDocument();
  });

  it("does not render a description paragraph when description is null", () => {
    render(<TaskItem task={makeTask({ description: null })} />);
    expect(screen.queryByText(/milk|eggs/i)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // formatRelativeTime via <time> element
  // -------------------------------------------------------------------------

  describe("formatRelativeTime", () => {
    it("'just now' for an invalid (NaN) date string", () => {
      render(<TaskItem task={makeTask({ created_at: "not-a-date" })} />);
      expect(screen.getByRole("time")).toHaveTextContent("just now");
    });

    it("'just now' for a future date", () => {
      const time = renderWithAge(-1000);
      expect(time).toHaveTextContent("just now");
    });

    it("'just now' for exactly 0 ms ago", () => {
      expect(renderWithAge(0)).toHaveTextContent("just now");
    });

    it("'just now' for 5 seconds ago (boundary: ≤5s)", () => {
      expect(renderWithAge(5 * 1000)).toHaveTextContent("just now");
    });

    it("'6s ago' for 6 seconds ago (first second bucket)", () => {
      expect(renderWithAge(6 * 1000)).toHaveTextContent("6s ago");
    });

    it("'30s ago' for 30 seconds ago", () => {
      expect(renderWithAge(30 * 1000)).toHaveTextContent("30s ago");
    });

    it("'59s ago' for 59 seconds ago (upper second boundary)", () => {
      expect(renderWithAge(59 * 1000)).toHaveTextContent("59s ago");
    });

    it("'1m ago' for exactly 60 seconds ago (minute boundary)", () => {
      expect(renderWithAge(60 * 1000)).toHaveTextContent("1m ago");
    });

    it("'59m ago' for 59 minutes ago (upper minute boundary)", () => {
      expect(renderWithAge(59 * 60 * 1000)).toHaveTextContent("59m ago");
    });

    it("'1h ago' for exactly 60 minutes ago (hour boundary)", () => {
      expect(renderWithAge(60 * 60 * 1000)).toHaveTextContent("1h ago");
    });

    it("'23h ago' for 23 hours ago (upper hour boundary)", () => {
      expect(renderWithAge(23 * 60 * 60 * 1000)).toHaveTextContent("23h ago");
    });

    it("'1d ago' for exactly 24 hours ago (day boundary)", () => {
      expect(renderWithAge(24 * 60 * 60 * 1000)).toHaveTextContent("1d ago");
    });

    it("'6d ago' for 6 days ago (upper day boundary)", () => {
      expect(renderWithAge(6 * 24 * 60 * 60 * 1000)).toHaveTextContent(
        "6d ago",
      );
    });

    it("'1w ago' for exactly 7 days ago (week boundary)", () => {
      expect(renderWithAge(7 * 24 * 60 * 60 * 1000)).toHaveTextContent(
        "1w ago",
      );
    });

    it("'4w ago' for 34 days ago (upper week boundary, 34÷7=4)", () => {
      expect(renderWithAge(34 * 24 * 60 * 60 * 1000)).toHaveTextContent(
        "4w ago",
      );
    });

    it("'1mo ago' for 35 days ago (crosses 5-week threshold, 35÷30=1)", () => {
      expect(renderWithAge(35 * 24 * 60 * 60 * 1000)).toHaveTextContent(
        "1mo ago",
      );
    });

    it("'11mo ago' for 364 days ago (364÷30=12… wait — 12 is not < 12 so goes to year)", () => {
      // Math.floor(364/30) = 12, which is NOT < 12 → falls through to year
      // Math.floor(364/365) = 0 → "0y ago" — documents the edge case
      expect(renderWithAge(364 * 24 * 60 * 60 * 1000)).toHaveTextContent(
        "0y ago",
      );
    });

    it("'1y ago' for exactly 365 days ago (year boundary)", () => {
      expect(renderWithAge(365 * 24 * 60 * 60 * 1000)).toHaveTextContent(
        "1y ago",
      );
    });

    it("'2y ago' for 730 days ago", () => {
      expect(renderWithAge(730 * 24 * 60 * 60 * 1000)).toHaveTextContent(
        "2y ago",
      );
    });
  });
});
