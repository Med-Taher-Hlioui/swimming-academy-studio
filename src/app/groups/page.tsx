import { PageHeading } from "@/components/ui";
import { GroupManager } from "@/features/groups/group-manager";

export default function GroupsPage() {
  return <>
    <PageHeading title="Groups" description="Create and edit fictional training groups, assign demo coaches and manage capacity." />
    <GroupManager />
  </>;
}
