export interface AnimeSeries {
  id: string;
  title: string;
  folderName: string;
  lastModified: string;
  url: string;
  genre?: string[];
  rating?: number;
  imageSeed?: string;
}
