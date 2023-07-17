//@ts-nocheck
namespace JSX {
    export type IntrinsicElements = { [index: string]: any };
}

let __effects = [];

class React {
    static get use() {
        // documentation, in case anyone looks in here. the below is a simple way you would use reactivity.
        //// let reactive = stateful({
        ////      a: 1
        //// })
        //// let elm = <p>{React.use(reactive.a)}</p>
        //// reactive.a += 1;

        // breaking this down, line by line
        // the first line creates the stateful proxy. it's just drop in for any normal object
        //// let closure = React.use
        // the above runs this function, clearing the __effects stack
        //// reactive.a
        // instead of getting the value like js normally would, the above will invoke the getter inside stateful(), pushing the *reference* of "a" into the __effects stack.
        //// let reference = closure()
        // runs the function below, cleaning up the __effects array and passing it down
        //// React.createElement("p",{},reference)
        // instead of passing the value of reactive.a, we passsed the return value of the below closure, which is an array contaning the property referenced, the origin object, and the proxy
        // the createElement function will then add a listener to the set() hook of the stateful proxy
        // React.createElement will then re-run all the important stuff once the reaction has happened
        __effects = [];
        return () => {
            const tmp = __effects;
            __effects = [];
            tmp.__alicejs_marker = true;
            return tmp;
        };
    }
    static createElement(
        type: string,
        props: { [index: string]: any } | null,
        ...children: (HTMLElement | string)[]
    ): HTMLElement {
        const elm: HTMLElement = document.createElement(type);

        if (props) {
            if ("if" in props) {
                const cond = props["if"];
                const then = props["then"];
                const elseelm = props["else"];

                if (typeof cond === "object" && "__alicejs_marker" in cond) {
                    elm.appendChild(then);

                    if (elseelm) elm.appendChild(elseelm);

                    handle(cond, (val) => {
                        if (val) {
                            then.style.display = "";
                            elseelm?.style.display = "none";
                        } else {
                            then.style.display = "none";
                            elseelm?.style.display = "";
                        }
                    });
                } else {
                    if (cond) {
                        elm.appendChild(then);
                    } else if (elseelm) {
                        elm.appendChild(elseelm);
                    }
                }

                delete props["if"];
                delete props["then"];
                delete props["else"];
            }
            if ("for" in props) {
                const predicate = props["for"];
                const closure = props["do"];

                if (
                    typeof predicate === "object" &&
                    "__alicejs_marker" in predicate
                ) {
                    const __elms = [];
                    handle(predicate, (val) => {
                        for (const part of __elms) {
                            part.remove();
                        }
                        for (const index in val) {
                            const value = val[index];

                            const part = closure(value, index, val);
                            __elms.push(part);
                            elm.appendChild(part);
                        }
                    });
                } else {
                    for (const index in predicate) {
                        const value = predicate[index];

                        const part = closure(value, index, predicate);
                        elm.appendChild(part);
                    }
                }

                delete props["for"];
                delete props["do"];
            }
            for (const name in props) {
                const prop = props[name];
                if (typeof prop === "object" && "__alicejs_marker" in prop) {
                    handle(prop, (val) => {
                        __assign_prop(elm, name, val);
                    });
                } else {
                    __assign_prop(elm, name, prop);
                }
            }
        }
        // todo: proper selective repainting
        for (const child of children) {
            if (typeof child === "object" && "__alicejs_marker" in child) {
                const text = document.createTextNode("");
                elm.appendChild(text);
                handle(child, (val) => {
                    text.textContent = val;
                });
            } else if (child instanceof Node) {
                elm.appendChild(child);
            } else {
                elm.appendChild(document.createTextNode(child));
            }
        }

        return elm;
    }
}
function __assign_prop(elm, name, prop) {
    if (name === "class") {
        elm.className = prop;
        return;
    }

    if (typeof prop === "function" && name.startsWith("on:")) {
        elm.addEventListener(name.substring(3), prop);
        return;
    }
    if (typeof prop === "function" && name.startsWith("observe")) {
        const observerclass = (window as any)[`${name.substring(8)}Observer`];
        if (!observerclass) {
            console.error(`Observer ${name} does not exist`);
            return;
        }
        const observer = new observerclass((entries: any) => {
            for (const entry of entries) {
                prop(entry);
            }
        });
        observer.observe(elm);
        return;
    }
    if (name.startsWith("bind:")) {
        const propname = name.substring(5);
        prop[propname] = elm;
        return;
    }

    elm.setAttribute(name, prop);
}
function stateful(target: object): object {
    target.__listeners = [];
    const proxy = new Proxy(target, {
        get(target, prop, reciever) {
            __effects.push([target, prop, reciever]);
            return Reflect.get(target, prop, reciever);
        },
        set(target, prop, val) {
            for (const listener of target.__listeners) {
                listener(target, prop, val);
            }
            return Reflect.set(target, prop, val);
        },
    });

    return proxy;
}

function handle(used: [any, any, any][], callback: () => void) {
    const p = used[used.length - 1];
    const closure = (target, prop, val) => {
        if (prop == p[1] && target == p[0]) {
            callback(val);
        }
    };
    p[0].__listeners.push(closure);
    closure(p[0], p[1], p[0][p[1]]);
}
//
// function x() {
//     const b = stateful({
//         counter: stateful({
//             b: 1,
//         }),
//         show: false,
//         list: ["test element", "element 2", "another list element", "element 4"],
//     });
//
//
//     document.body.appendChild(
//         <div>
//             <div
//                 if={React.use(b.show)}
//                 then={<p>b.show is true</p>}
//                 else={<p>b.show is fale</p>}
//             />
//
//             <p>reactivity demo</p>
//             <p asd={React.use(b.counter.b)}>
//                 the value of a is {React.use(b.counter.b)}
//             </p>
//             <div for={b.list} do={(v, i) => {
//                 return (<p>
//                     #{i} of "b.list" is {v}
//                 </p>);
//             }} />
//             <button
//                 on:click={() => {
//
//                     b.counter.b += 1;
//                 }}
//             >
//                 click me!
//             </button>
//         </div>,
//     );
//     window.br = b;
// }
// window.addEventListener("load", x);
