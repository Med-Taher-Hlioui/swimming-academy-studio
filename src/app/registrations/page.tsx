import { PageHeading } from "@/components/ui";
import { RegistrationList } from "@/features/registrations/registration-list";

export default function RegistrationsPage() {
  return <>
    <PageHeading title="Registrations" description="Practice a registration enquiry and review workflow using fictional applicant aliases." />
    <RegistrationList />
  </>;
}
