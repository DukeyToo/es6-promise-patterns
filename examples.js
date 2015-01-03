/**
 * For reference, this is the synchonous equivalent to all the async examples.  Its just a simple loop with some output.
 **/
function syncWork(input) {
    var output = (input || "");
    for (var i = 0; i < 10; i++) {
        output += (i + " ");
    }
    return output;
}

/**
 * Fake random async work.  Returns (input + i + " ")
 **/
function doTheWork(input, i) {
    //normal async work will probably have its own promise, but we need to create our own:
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            var output = (input || "") + i + " ";
            resolve(output);
        }, Math.floor(Math.random() * 200) + 1)
    });
}

/**
 * Loops sequentially over an async function named doTheWork.  This is useful
 * when each iteration depends on some result from the previous one.  It is the slowest async loop,
 * so only use it when absolutely necessary.
 *
 * This is the simplest variant, but it outputs the indexes in descending order.  Use it if your work
 * function does not care about the index, or only needs to know when its on the last item.
 **/
function seqLoopDescending(someInput, times) {
    return new Promise(function (resolve, reject) {
        if (times == 0) {
            resolve(someInput);
        } else {
            doTheWork(someInput, times - 1).then(function (workOutput) {
                resolve(seqLoopDescending(workOutput, times - 1));
            })
        }
    });
}

/**
 * Loops sequentially over an async function named doTheWork.  This is useful
 * when each iteration depends on some result from the previous one.  It is the slowest async loop,
 * so only use it when absolutely necessary.
 *
 * This is a more complex variant, in order to output the indexes in ascending order
 **/
function seqLoopAscending(someInput, times) {
    var limit = times;

    var seqLoop = function (someInput, times) {
        return new Promise(function (resolve, reject) {
            if (times == 0) {
                resolve(someInput);
            } else {
                doTheWork(someInput, limit - times).then(function (workOutput) {
                    resolve(seqLoop(workOutput, times - 1));
                })
            }
        });
    };
    return seqLoop(someInput, times);
}

/**
 * Loops randomly over an async function named doTheWork.  This is useful
 * when each iteration can execute independently of the last, but we need to
 * wait for them all before continuing.
 *
 * This variant shows the output in the original requested order.
 **/
function asyncLoopOrdered(someInput, times) {
    return new Promise(function (resolve, reject) {
        var iterations = [];
        for (var i = 0; i < times; i++) {
            iterations.push(doTheWork("", i));
        }

        Promise.all(iterations).then(function (output) {
            resolve(someInput + output.join("")); //add the output all at once when all have completed
        }).
        catch (function (err) {
            reject(err);
        });
    });
}

/**
 * Loops randomly over an async function named doTheWork.  This is useful
 * when each iteration can execute independently of the last, but we need to
 * wait for them all before continuing.
 *
 * This variant shows the output in the order it completes, i.e. random.
 **/
function asyncLoopRandom(someInput, times) {
    return new Promise(function (resolve, reject) {
        var finalOutput = someInput;
        var iterations = [];
        for (var i = 0; i < times; i++) {
            var p = doTheWork("", i);
            iterations.push(p);
            p.then(function (output) {
                finalOutput += output; //add the output as it becomes ready
            });
        }

        Promise.all(iterations).then(function (output) {
            resolve(finalOutput);
        }).
        catch (function (err) {
            reject(err);
        });
    });
}

/**
 * Loops sequentially over async function named doTheWork.  Makes use of array reduce
 * function to iterate sequentially and feed previous value into next.
 *
 * This sequential loop has the advantage of not explicitly using recursion, so it
 * may be more memory-efficient than the recursive style.  Arguably it is also more readable.
 **/
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

/**
 * Max in process throttle limits the number of items of work
 * that are in-process at any one time.
 *
 * Example use case is if we have some processor-bound work and we don't want to
 * exceed the number of processor cores available to do the work.
 **/
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

/**
 * Max per period throttle limits the number of items of work
 * that can be requested per period, e.g. 3 per 10ms.  It does not limit
 * the number that can be in-process at a time, i.e. if the first 3 were
 * started but not yet done when the 10ms interval ends, then the next 3
 * could still start.
 *
 * Example use case is if we want to limit the rate of some call to
 * an external system, e.g. Ajax calls.
 **/
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

/**
 * Limits the number of tasks that can be in-process per period, e.g. only 3
 * tasks can be running within each 10ms period.  This is more restrictive than "maxRequestsPerPeriodThrottle"
 * which only limits the number that are requested.  It makes a difference if the processes take a longer time.
 */
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

/**
 * A resource limiter limits some resource.  numResources is the size of the resource pool
 **/
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
