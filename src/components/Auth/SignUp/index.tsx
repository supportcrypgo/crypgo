"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Logo from "@/components/Layout/Header/Logo";
import { useState, type FormEvent } from "react";
import { authApi } from "@/data/api";
const SignUp = ({ showLogo = true }: { showLogo?: boolean }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);
    setRegistrationError(null);
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") || "");
    const password = String(data.get("password") || "");

    authApi.register({ email, password })
      .then(() => {
        toast.success("Successfully registered");
        setLoading(false);
        router.push("/auth/sign-in");
      })
      .catch((err) => {
        setRegistrationError(
          err instanceof Error ? err.message : "Registration failed. Please try again.",
        );
        setLoading(false);
      });
  };

  return (
    <>
      {showLogo && (
        <div className="mb-10 text-center mx-auto inline-block max-w-[160px]">
          <Logo />
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-[22px]">
          <input
            type="email"
            placeholder="Email"
            name="email"
            required
            onChange={() => setRegistrationError(null)}
            className="w-full rounded-md border border-dark_border border-opacity-60 border-solid bg-transparent px-5 py-3 text-base text-dark outline-none transition placeholder:text-grey focus:border-primary focus-visible:shadow-none text-white dark:focus:border-primary"
          />
          {registrationError && (
            <p role="alert" className="mt-2 text-sm text-red-400">
              {registrationError}
            </p>
          )}
        </div>
        <div className="mb-[22px]">
          <input
            type="password"
            placeholder="Password"
            name="password"
            required
            className="w-full rounded-md border border-dark_border border-opacity-60 border-solid bg-transparent px-5 py-3 text-base text-dark outline-none transition placeholder:text-grey focus:border-primary focus-visible:shadow-none text-white dark:focus:border-primary"
          />
        </div>
        <div className="mb-9">
          <button
            type="submit"
            className="flex w-full items-center text-18 font-medium justify-center rounded-md bg-primary px-5 py-3 text-darkmode transition duration-300 ease-in-out hover:bg-transparent hover:text-primary border-primary border "
          >
            Sign Up
          </button>
        </div>
      </form>

      <p className="text-body-secondary mb-4 text-white text-base">
        By creating an account you are agree with our{" "}
        <a href="/#" className="text-primary hover:underline">
          Privacy
        </a>{" "}
        and{" "}
        <a href="/#" className="text-primary hover:underline">
          Policy
        </a>
      </p>

      <p className="text-body-secondary text-white text-base">
        Already have an account?
        <Link href="/auth/sign-in" className="pl-2 text-primary hover:underline">
          Sign In
        </Link>
      </p>
    </>
  );
};

export default SignUp;
