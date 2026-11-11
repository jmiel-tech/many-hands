// The only tools the model is offered. They're defined here on the server, so a caller can't add its own.
// The Worker never runs them: the browser does, through the app's existing functions, as the signed-in
// member, after the member presses Confirm. Firestore's rules still apply to every change.

const taskId = { type: 'string', description: 'The task id from the community data (id=...).' };

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'find_tasks',
      description: 'Look up tasks. Read-only.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Words to match in a task or issue title or description.' },
          scope: { type: 'string', enum: ['needs_someone', 'mine', 'all'], description: 'needs_someone = nobody holds it; mine = held by the member.' },
          status: { type: 'string', enum: ['todo', 'doing', 'done'] },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'take_task',
      description: 'Assign a task nobody holds to the member. The member confirms first.',
      parameters: { type: 'object', properties: { task_id: taskId }, required: ['task_id'], additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_my_task_status',
      description: "Change the status of a task the member holds. The member confirms first.",
      parameters: {
        type: 'object',
        properties: { task_id: taskId, status: { type: 'string', enum: ['todo', 'doing', 'done'] } },
        required: ['task_id', 'status'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_comment',
      description: 'Post a comment on any task as the member. The member confirms first.',
      parameters: {
        type: 'object',
        properties: { task_id: taskId, text: { type: 'string', maxLength: 2000 } },
        required: ['task_id', 'text'],
        additionalProperties: false,
      },
    },
  },
];

export const TOOL_NAMES = new Set(TOOLS.map((t) => t.function.name));
