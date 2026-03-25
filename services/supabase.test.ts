/* eslint-disable import/first */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteItemAsyncMock, signOutMock, signUpMock } = vi.hoisted(() => ({
  deleteItemAsyncMock: vi.fn(),
  signOutMock: vi.fn(),
  signUpMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(),
      signUp: signUpMock,
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: signOutMock,
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
    },
  })),
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        SUPABASE_URL: "https://example.test",
        SUPABASE_ANON_KEY: "anon-key",
      },
    },
  },
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: deleteItemAsyncMock,
}));

vi.mock("react-native", () => ({
  Platform: {
    OS: "ios",
  },
}));

import {
  clearSupabaseSessionStorage,
  logout,
  registerWithEmail,
} from "./supabase";

describe("supabase auth cleanup", () => {
  beforeEach(() => {
    signOutMock.mockReset();
    deleteItemAsyncMock.mockReset();
    signUpMock.mockReset();
  });

  it("removes persisted auth storage when clearing the session cache", async () => {
    await clearSupabaseSessionStorage();

    expect(deleteItemAsyncMock).toHaveBeenCalledWith(
      "assistant.supabase.auth.token",
    );
  });

  it("clears persisted auth storage even when signOut fails", async () => {
    signOutMock.mockRejectedValue(new Error("refresh token not found"));

    await expect(logout()).rejects.toThrow("refresh token not found");

    expect(deleteItemAsyncMock).toHaveBeenCalledWith(
      "assistant.supabase.auth.token",
    );
  });

  it("passes the display name to Supabase auth metadata on registration", async () => {
    await registerWithEmail(
      "naam@voorbeeld.nl",
      "SterkWachtwoord1",
      "https://www.budio.nl/auth/login",
      "Pieter Flikweert",
    );

    expect(signUpMock).toHaveBeenCalledWith({
      email: "naam@voorbeeld.nl",
      password: "SterkWachtwoord1",
      options: {
        emailRedirectTo: "https://www.budio.nl/auth/login",
        data: {
          name: "Pieter Flikweert",
          full_name: "Pieter Flikweert",
        },
      },
    });
  });
});
