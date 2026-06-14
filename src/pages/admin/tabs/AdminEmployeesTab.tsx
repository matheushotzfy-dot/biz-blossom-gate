import StaffManagementTab from "./StaffManagementTab";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  profiles: Tables<"profiles">[];
  onReload: () => void;
}

export default function AdminEmployeesTab({ profiles, onReload }: Props) {
  return <StaffManagementTab profiles={profiles} onReload={onReload} role="employee" />;
}
