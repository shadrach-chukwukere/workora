"use client"

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";

interface PaystackButtonProps {
  amount: number; // Amount in USD/EUR/NGN etc.
  email: string;
  onSuccess?: (transactionId: string, amount: number) => void;
  onError?: (error: string) => void;
  className?: string;
}

/**
 * Paystack Button - Handles inline payment collection via Paystack
 * 
 * Usage: <PaystackButton amount={50} email="user@example.com" />
 */
export function PaystackButton({ amount, email, onSuccess, onError, className }: PaystackButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [reference, setReference] = useState(`workora-${Date.now()}`);

  const handlePay = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/paystack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          email,
          reference,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Payment failed");
      }

      // In a real implementation, you'd use Paystack Inline SDK here
      // For now, simulate success
      if (onSuccess) {
        onSuccess(data.reference || reference, amount);
      }
    } catch (error: any) {
      if (onError) {
        onError(error.message || "Payment failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      size="lg"
      disabled={isLoading}
      className={className}
      onClick={handlePay}
    >
      {isLoading ? (
        <span className="align-middle">
          <span className="spinner spinner-sm mr-2" />
          Processing payment
        </span>
      ) : (
        <>
          <span className="align-middle">
            <Icon icon={ArrowRight02Icon} size={16} strokeWidth={1.8} className="mr-2" />
            Pay ${amount}
          </span>
        </>
      )}
    </Button>
  );
}