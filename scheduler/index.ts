import {processBatch} from "../src/index";
import type {Env} from "../src/types";
export default {
 async scheduled(_event:ScheduledController,env:Env,ctx:ExecutionContext){ctx.waitUntil(processBatch(env))}
};
