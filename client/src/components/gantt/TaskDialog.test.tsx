import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskDialog } from "./TaskDialog";
import { seedSnapshot } from "../../test/fixtures";

function renderDialog() {
  return render(
    <TaskDialog
      open
      task={null}
      projectId="proj-1"
      snapshot={seedSnapshot()}
      onClose={vi.fn()}
      onTasksChange={vi.fn()}
      onRefresh={vi.fn()}
      onSuccess={vi.fn()}
      onError={vi.fn()}
    />,
  );
}

describe("TaskDialog", () => {
  it("menolak nama kosong saat tugas baru disimpan", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Tambah tugas" }));

    expect(await screen.findByText("Nama tugas wajib diisi.")).toBeInTheDocument();
  });

  it("menolak durasi di bawah satu hari kerja", async () => {
    const user = userEvent.setup();
    renderDialog();

    const duration = screen.getByLabelText(/Durasi \(hari kerja\)/);
    await user.clear(duration);
    await user.type(duration, "0");
    await user.click(screen.getByRole("button", { name: "Tambah tugas" }));

    expect(await screen.findByText("Durasi minimal 1 hari kerja.")).toBeInTheDocument();
  });
});
