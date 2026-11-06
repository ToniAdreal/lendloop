import { SignUp } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <div className="flex justify-center py-10">
      <SignUp />
    </div>
  );
}
