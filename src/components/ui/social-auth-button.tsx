import { Button } from "./button";

/**
 * Modern Google OAuth button - premium gradient design
 * Clean rounded corners with Google's primary colors
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
 * Modern GitHub OAuth button - premium dark mode design
 * Clean rounded corners with GitHub's dark theme colors
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