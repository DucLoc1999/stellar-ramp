import db from '../db';

export interface User {
  id: number;
  id_number: string;
  name: string;
  dob: Date | string;
  sex: string | null;
  nationality: string | null;
  home: string | null;
  address: string | null;
  doe: Date | string | null;
  phone: string | null;
  email: string | null;
  kyc_image_front: string | null;
  kyc_image_back: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface CreateUserInput {
  id_number: string;
  name: string;
  dob: Date;
  sex?: string | null;
  nationality?: string | null;
  home?: string | null;
  address?: string | null;
  doe?: Date | null;
  phone?: string | null;
  email?: string | null;
  kyc_image_front?: string | null;
  kyc_image_back?: string | null;
}

const table = 'users';

export async function findById(id: number): Promise<User | undefined> {
  return db(table).where({ id }).first();
}

export async function findByIdNumber(idNumber: string): Promise<User | undefined> {
  return db(table).where({ id_number: idNumber }).first();
}

export async function findByPhone(phone: string): Promise<User | undefined> {
  return db(table).where({ phone }).first();
}

export async function findByEmail(email: string): Promise<User | undefined> {
  return db(table).where({ email }).first();
}

export async function findByQuery(query: {
  id?: number;
  phone?: string;
  email?: string;
  id_number?: string;
}): Promise<User | undefined> {
  if (query.id) return findById(query.id);
  if (query.id_number) return findByIdNumber(query.id_number);
  if (query.phone) return findByPhone(query.phone);
  if (query.email) return findByEmail(query.email);
  return undefined;
}

export async function create(data: CreateUserInput): Promise<User> {
  const [row] = await db(table).insert(data).returning('*');
  return row;
}
