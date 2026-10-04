import PortalLayout from "../components/PortalLayout";
import { useAuth } from "../useAuth";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <PortalLayout>
      <div className="card max-w-md bg-base-200 shadow-xl">
        <div className="card-body">
          <h1 className="card-title">Welcome, {user?.username}</h1>
          <p className="text-sm opacity-70">{user?.email}</p>
          <div className="badge badge-primary mt-2 w-fit capitalize">{user?.role}</div>
        </div>
      </div>
    </PortalLayout>
  );
}
