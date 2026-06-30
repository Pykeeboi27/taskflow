"use client";

type TaskFilter = "pending" | "completed" | undefined;

type TaskFiltersProps = {
  activeFilter: TaskFilter;
  onFilterChange: (filter: TaskFilter) => void;
};

const filters: Array<{ label: string; value: TaskFilter }> = [
  { label: "All", value: undefined },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
];

export default function TaskFilters({ activeFilter, onFilterChange }: TaskFiltersProps) {
  return (
    <div className="flex gap-2">
      {filters.map((filter) => {
        const isActive = activeFilter === filter.value;

        return (
          <button
            key={filter.label}
            type="button"
            onClick={() => onFilterChange(filter.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}