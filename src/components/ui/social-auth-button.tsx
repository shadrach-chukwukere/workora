import { Button } from "./button";

/**
 * Modern Google OAuth button - styled with Google's primary colors
 * Premium gradient background with hover effects
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
 * Modern GitHub OAuth button - styled with GitHub's colors
 * Premium dark mode background with hover effects
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