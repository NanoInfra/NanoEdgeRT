// export interface Queue {
//   trace_id: string;
//   task_id: string;

//   status: "running" | "stopped" | "failed";
//   start_time: Date;
//   end_time?: Date;
// }

// export interface Trace {
//   id: string; // Unique identifier for the trace
//   trace_id: string; // the hole trace id, used to group events
//   task_id: string; // the Task object id
//   event:
//     | "start"
//     | "stream"
//     | "end"
//     | "failed"
//     // console
//     | "log"
//     | "warning"
//     | "error"
//     | "trace";
//   // other
//   timestamp: Date; // When the event occurred
//   data?: object; // Additional data related to the event, stringified json
// }

// // cron: cron != null, and last_run is meeting the cron schedule
// export interface Task {
//   id: string;
//   name: string;

//   concurrency_count: number; // select ... limit *; promise.allsattled([data])
//   retry_count: number; // retry count, if failed, retry this many times
//   retry_delay: number; // retry delay in milliseconds

//   // TODO: cron expression for scheduling
//   // cron?: string; // Cron expression for scheduling
//   // last_run?: Date; // Last run time
// }

// // create a task, inherits from create function
