import { Button } from "./button";

/**
 * Google OAuth button - styled with Google's primary colors
 */
export function GoogleAuthButton({
  className,
  size = "md",
  onClick,
  ...props
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size={size}
      className={className}
      onClick={onClick}
      {...props}
    >
      Sign in with Google
    </Button>
  );
}

/**
 * GitHub OAuth button - styled with GitHub's colors
 */
export function GitHubAuthButton({
  className,
  size = "md",
  onClick,
  ...props
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size={size}
      className={className}
      onClick={onClick}
      {...props}
    >
      Sign in with GitHub
    </Button>
  );
}