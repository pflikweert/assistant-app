export type ImportMetadata = Record<string, string>;

export type NormalizedImportTransaction = {
  date: string;
  amount: number;
  details: string;
  counterparty?: string;
  currency?: string;
  type?: string;
  metadata?: ImportMetadata;
  seq?: number;
};
