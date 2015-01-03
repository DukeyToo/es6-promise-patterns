es6-promise-patterns
====================

Not a component; just some example code showing patterns working with es6 promises.  I was struggling to write some
code that had to loop over asynchronous work in various ways, so I looked for some example patterns, and could not
find any simple examples.

The examples I have so far (see examples.js):

* async loop ordered - simple loop over asynchonous work.  Returns the output all at the end, in the order that the work was requested.
* async loop unordered - simple loop over asynchronous work.  Returns the output all at the end, in the order that the work completed.
* sequential loop - loop over asynchronous work where each iteration requires that the previous one is completed.
* resource limiter - used internally for throttling - an object that lets you checkout/take and checkin/give resources.
* throttled loop, max in process - throttled loop, limiting the number of work-items that can be in process at one time.
* throttled loop, max requests per period - throttled loop, limiting the number of work-items that are started in some time period, e.g. max 10 per minute.
* throttled loop, max in process per period - throttled loop, limiting the number of work-iterms that may be in-process in some time period, e.g. max 10 per minute.

See also my working examples on jsfiddle - http://jsfiddle.net/dukeytoo/02ohnth4/

Example work
###

In all examples, the work is the euivalent of the following synchronous code:
```
function syncWork(input) {
    var output = (input || "");
    for (var i = 0; i < 10; i++) {
        output += (i + " ");
    }
    return output;
}
```

For example, ```syncWork("Example: ", 10)``` would output the following:  ```Example: 0 1 2 3 4 5 6 7 8 9```.  Generally, the async examples output in random order.

An equivalent promisified async work-task is:
```
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

Async loop ordered
####

```
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

Async loop unordered
####

```
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

To call, we would do something like: ```asyncLoopRandom("Example: ", 10).then(function(result) { console.log(result); });``` which would output ```Example: 4 5 9 0 7 8 1 6 2 3```.

This example works the same as the previous one, but it collects the output as it becomes ready.

Sync loop
####

```
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

