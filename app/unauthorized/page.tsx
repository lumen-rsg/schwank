import ErrorState from '../error-state';
export default function UnauthorizedPage() {
  return (
    <ErrorState
      code="401"
      title="Sign in required"
      copy="Sign in to open your household workspace."
    />
  );
}
