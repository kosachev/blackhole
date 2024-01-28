import { vi } from "vitest";

export const mockAmoService = () => {
  vi.mock("../../src/amo/amo.service", () => {
    return {
      AmoService: vi.fn().mockImplementation(() => {
        return {
          client: {
            lead: {
              updateLeadById: vi.fn((id: any, lead: any) => [id, lead]),
            },
            note: {
              addNotes: vi.fn((entity_type: any, notes: any[]) => [entity_type, notes]),
            },
            task: {
              addTasks: vi.fn((tasks: any[]) => [tasks]),
            },
          },
        };
      }),
    };
  });
};

export const task = {
  task: {
    update: [
      {
        id: 11122233,
        element_id: 33322211,
        element_type: 2,
        task_type: 1,
        date_create: "2017-07-20 15:00:00",
        text: "Follow-up",
        status: 1,
        account_id: 77711122,
        created_user_id: 123123,
        last_modified: "2017-07-21 19:00:00",
        responsible_user_id: 123123,
        complete_till: "2017-07-22 23:59:00",
        action_close: 1,
        result: {
          id: 155155155,
          text: "Success",
        },
      },
    ],
  },
  account: {
    subdomain: "test",
  },
};
