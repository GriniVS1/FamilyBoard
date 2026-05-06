export type TodoMember = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  role: string;
};

export type Todo = {
  id: string;
  familyId: string;
  memberId: string | null;
  title: string;
  done: boolean;
  dueDate: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type TodoCreateInput = {
  title: string;
  memberId?: string | null;
  dueDate?: string | null;
};

export type TodoPatchInput = Partial<{
  title: string;
  memberId: string | null;
  dueDate: string | null;
  done: boolean;
}>;
