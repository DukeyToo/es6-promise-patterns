## es6-promise-patterns

Not a component; just some example code showing patterns working with es6 promises.  I was struggling to write some
code that had to loop over asynchronous work in various ways, so I looked for some example patterns, and could not
find any simple examples.

The examples I have so far (see examples.js):

* **async loop ordered** - simple loop over asynchonous work.  Returns the output all at the end, in the order that the work was requested.
* **async loop unordered** - simple loop over asynchronous work.  Returns the output all at the end, in the order that the work completed.
* **sequential loop** - loop over asynchronous work where each iteration requires that the previous one is completed.
* **resource limiter** - used internally for throttling - an object that lets you checkout/take and checkin/give resources.
* **throttled loop**, max in process - throttled loop, limiting the number of work-items that can be in process at one time.
* **throttled loop**, max requests per period - throttled loop, limiting the number of work-items that are started in some time period, e.g. max 10 per minute.
* **throttled loop**, max in process per period - throttled loop, limiting the number of work-iterms that may be in-process in some time period, e.g. max 10 per minute.

See also my working examples on jsfiddle - http://jsfiddle.net/dukeytoo/02ohnth4/

I welcome all feedback/corrections.  The examples are all as good as I could make them, but I'm sure that there are ways they can be improved, and other examples that
would be useful.  Log an issue or do a pull request to let me know.

### Example task

In all examples, the work is the euivalent of the following synchronous code:
```JavaScript
function syncWork(input) {
    var output = (input || "");
    for (var i = 0; i < 10; i++) {
        output += (i + " ");
    }
    return output;
}
```

For example, ```syncWork("Example: ", 10)``` would output the following:  ```Example: 0 1 2 3 4 5 6 7 8 9```.

An equivalent promisified async work-task is:
```JavaScript
function doTheWork(input, i) {
    //normal async work will probably have its own promise, but we need to create our own:
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            var output = (input || "") + i + " ";
            resolve(output);
        }, Math.floor(Math.random() * 200) + 1)
    });
}
```
(needs to be called in a loop to get the same final output).  This example is contrived - the "async" part is using a timeOut to simulate async work of a random length.  In a real-world
example you would do something naturally async, like an Ajax call, and return a Promise which will resolve when the work is complete.

#### Async loop ordered

```JavaScript
function asyncLoopOrdered(someInput, times) {
    var iterations = [];
    for (var i = 0; i < times; i++) {
        iterations.push(doTheWork("", i));
    }

    return Promise.all(iterations).then(function(output) {
        return someInput + output.join(""); //add the output all at once when all have completed
    });
}
```

To call, we would do something like: ```asyncLoopOrdered("Example: ", 10).then(function(result) { console.log(result); });``` which would output ```Example: 0 1 2 3 4 5 6 7 8 9```.

The example kicks-off all of the work, and creates an array of promises for the results.  It then uses ```Promises.all``` to wait for all of the work to complete, and then return the final result.
The work outputs in the requested order because ```Promise.all``` returns the results in the order that the promises were added.  In the next example, we see how to return the output in the order it completed.

#### Async loop unordered

```JavaScript
function asyncLoopRandom(someInput, times) {
    var finalOutput = someInput;
    var iterations = [];
    for (var i = 0; i < times; i++) {
        var p = doTheWork("", i).then(function(output) {
            finalOutput += output; //add the output as it becomes ready
        });
        iterations.push(p);
    }

    return Promise.all(iterations).then(function (output) {
        return finalOutput;
    });
}
```

To call, we would do something like: ```asyncLoopRandom("Example: ", 10).then(function(result) { console.log(result); });``` which could output ```Example: 4 5 9 0 7 8 1 6 2 3```.

This example works the same as the previous one, but it collects the output as it becomes ready.

#### Sync loop

```JavaScript
function seqLoopReduce(someInput, times) {
    var arr = new Array(times);
    for (var i = 1; i < times; i++) {
        arr[i] = i; //we need to populate the array because Array.reduce will ignore empty elements
    }

    return arr.reduce(function (prev, curr) {
        return prev.then(function (val) {
            return doTheWork(val, curr); //curr = current arr value, val = return val from last iteration
        });
    }, doTheWork(someInput, 0));
}
```

To call, we would do something like: ```seqLoopReduce("Example: ", 10).then(function(result) { console.log(result); });``` which would output ```Example: 0 1 2 3 4 5 6 7 8 9```.

The work executes sequentially - each step will wait for the one before it.  This will take a long time, but is appropriate for types of work where each iteration builds on the previous.

The "trick" to executing the work sequentially is to make use of the ```Array.Reduce()``` function, which is built for sequential work of this kind.  The alternative would be to use
recursion, which would be more code, harder to read and less efficient.

#### Resource Limiter

In order to do any type of throttling, we need a way to limit ourselves.  What better way than a simple object that maintains a "pool" of a certain size, and returns
promises that resolve when there is an available resource in the pool?  That is pretty easy to write:

```JavaScript
function resourceLimiter(numResources) {
    var my = {
        available: numResources,
        max: numResources
    };

    var futures = [];  //array of callbacks to trigger the promised resources

    /*
     * takes a resource.  returns a promises that resolves when the resource is available.
     * promises resolve FIFO.
     */
    my.take = function() {
        if (my.available > 0) {
            my.available -= 1;
            return Promise.resolve();
        } else {
            var p = new Promise(function(resolve, reject) {
                futures.push(resolve);
            });

            return p;
        }
    }

    /*
     * returns a resource to the pool
     */
    my.give = function() {
        if (futures.length) {
            my.available += 1;
            var future = futures.shift();
            future();
        }
    }

    return my;
};
```

The throttling examples below shows how to use the resource limiter.

#### Throttled Loop, Max in-process

```JavaScript
function maxInProcessThrottle(someInput, times, limit) {
    var limiter = resourceLimiter(limit);  //max "limit" in-process at a time
    var finalOutput = someInput;
    var tasks = new Array(times);

    function executeTask(i) {
        return function() {
            return doTheWork("", i).then(function(result) {
                finalOutput += result;
                limiter.give();
            });
        }
    }

    for (var i=0; i<times; i++) {
        tasks[i] = limiter.take().then(executeTask(i));
    }

    return Promise.all(tasks).then(function(results) {
        return finalOutput;
    });
}
```

This example uses the resource-limited to throttle the work.  We would use it like ```maxInProcessThrottle("Example: ", 10, 3)``` which would execute 10 iterations, with a
maximum of 3 in-process at any one time, and output something like ```Example: 4 5 9 0 7 8 1 6 2 3```.

This is the first non-sequential example where we are not starting all tasks at the beginning.  Because of this, we have to use
a wrapper function ```executeTask``` to wrap the task with its input parameter ```i```.  (If we don't do that then JavaScript will not maintain the correct value of ```i``` for us).
Doing that adds some complexity and makes the code a little harder to read.

At least the main loop is easy to read - ```limiter.take().then(executeTask(i));```, i.e. take a resource, then execute the task.  When the task completes, it calls ```limiter.give()```
to return the resource to the pool, which allows another iteration to take it.

The overall effect is that the tasks are resource-starved and have to wait for the limiter to release resources before they can be kicked off.

#### Throttled Loop, Max requests per Period

```JavaScript
function maxRequestsPerPeriodThrottle(someInput, times, limit, ms) {
    //the way it works is that the timer gives back a resource every time it triggers,
    //and the tasks take them whenever they can.
    var limiter = resourceLimiter(limit);  //max "limit" in-process at a time
    var timer = setInterval(function() {
        for (var i=0; i<limit; i++)
            limiter.give();  //give back "limit" resources every "ms" ms
    }, ms);

    var finalOutput = someInput;
    var tasks = new Array(times);

    function executeTask(i) {
        return function() {
            return doTheWork("", i).then(function(result) {
                finalOutput += result;
            });
        }
    }

    for (var i=0; i<times; i++) {
        tasks[i] = limiter.take().then(executeTask(i));
    }

    return Promise.all(tasks).then(function(results) {
        clearInterval(timer);
        return finalOutput;
    });
}
```

Here we introduce a new use of the resource limiter - we have a tasks that take a resource to when they start, but don't ever return the resource.  Instead, we have a
timer that regularly returns resources.

The overall structure is the same as the previous example, but now the tasks are starved by the timer.  A new task cannot execute until the timer makes
a resource available.  The effect is that a max of ```limit``` tasks can start every ```ms``` milliseconds.

Also worth noting is that this does not restrict the number of tasks that can be simultaneously executing.  If the tasks take a long time, then the timer still returns
the resource and the next task can still start.  We see how to address that in the next example.


#### Throttled Loop, Max in-process per Period

```JavaScript
function maxInProcessPerPeriodThrottle(someInput, times, limit, ms) {
    //a task will only start executing when there is *both* a time and a process resource available.
    //The effective limit is whichever one of them is in the least supply.  For long-running tasks the
    //process resource will be in short supply, and for short running tasks the time resource will be a constraint.

    var processLimiter = resourceLimiter(limit); //max "limit" in-process at a time.
    var timeLimiter = resourceLimiter(limit);  //limits to start "limit" times per "ms" ms.
    var timer = setInterval(function() {
        for (var i=0; i<limit; i++)
            timeLimiter.give();  //give back the timed resource every "ms" ms
    }, ms);

    var finalOutput = someInput;
    var tasks = new Array(times);

    function executeTask(i) {
        return function() {
            return doTheWork("", i).then(function(result) {
                finalOutput += result;
                processLimiter.give();
            });
        }
    }

    for (var i=0; i<times; i++) {
        tasks[i] = Promise.all([timeLimiter.take(), processLimiter.take()]).then(executeTask(i));
    }

    return Promise.all(tasks).then(function(results) {
        clearInterval(timer);
        return finalOutput;
    });
}
```

Similarly to the previous example, this one has a timer that limits resources.  However, it *also* has a normal resource limiter that limits the number of tasks that can
execute in parallel.  The line of code ```Promise.all([timeLimiter.take(), processLimiter.take()]).then(executeTask(i));``` ensures that a task will only execute when
it has a resource of each type.  The combined effect is that the tasks are throttled to a maximum *in-process* per specified period.

