import { createFileRoute, Outlet } from "@tanstack/react-router";
import { getRestaurant } from "@/lib/api/restaurant.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/app")({
  component: () => <Outlet />,
});
