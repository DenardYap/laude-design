export type RecencyBucket = "today" | "week" | "month" | "older";

export interface ProjectListItem {
  id: string;
  name: string;
  updatedAt: Date | string;
}

export interface ProjectListProps {
  projects: ProjectListItem[];
}

export interface ProjectRowProps {
  project: ProjectListItem;
  zebra: boolean;
  onRequestDelete: () => void;
}
