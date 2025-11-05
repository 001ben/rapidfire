export interface TableHeader {
    index: number;
    name: string;
    type: string;
    selected: boolean;
    isColorColumn?: boolean;
  }
// Define the shape of the dataset object

export interface Dataset {
  name: string;
  url: string;
  type: "csv" | "parquet";
}

export type ViewState = {
  mode: 'table' | 'plot';
  plotSpec: string;
  viewName: string;
};
  