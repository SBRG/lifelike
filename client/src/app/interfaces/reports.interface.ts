export interface CopyrightInfringementRequest {
  url: string;
  description: string;
  name: string;
  company: string;
  address: string;
  country: string;
  city: string;
  province: string;
  zip: string;
  phone: string;
  fax?: string;
  email: string;
  attestationCheck1: boolean;
  attestationCheck2: boolean;
  attestationCheck3: boolean;
  attestationCheck4: boolean;
  signature: string;
}
