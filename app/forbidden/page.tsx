import ErrorState from '../error-state';
export default function ForbiddenPage() {
  return (
    <ErrorState
      code="403"
      title="This stays private"
      copy="You do not have permission to view or change this item."
    />
  );
}
