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