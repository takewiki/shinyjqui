shinyjqui = function() {

  // If the target element has class "shiny-bound-input", which usually the case
  // when user uses an id to refer to a shiny input, we should redirect this
  // target element to its shiny-input-container so that the whole shiny input
  // but not a part of it would be affected. This is very important when the
  // shiny input are checkboxInput, fileInput, numericInput, selectInput,
  // sliderInput, textInput, textAreaInput and passwordInput whose id-containing
  // elements are located deep inside the shiny-input-container. However, the
  // only exception is actionButton who dosen't have a shiny-input-container.
  var getInputContainer = function(el) {

    // if the target element is not a shiny input, just cancel the operation
    if(!($(el).hasClass("shiny-bound-input"))) {
      return el;
    }
    // if it is a shiny actionBotton, cancel the operation
    if($(el).hasClass("btn")) {
      return el;
    }

    var $container = $(el).closest(".shiny-input-container");
    if($container.length) {
      return $container.get(0);
    } else {
      return el;
    }
  };

  var regShinyInput = function(el, id, opt) {
    $.each(opt, function(suffix, callbacks){
      var input_name = id + '_' + suffix;
      $.each(callbacks, function(event_type, func){
        $(el).on(event_type, function(event, ui){
          var input_value = func(event, ui);
          Shiny.onInputChange(input_name, input_value);
        });
      });
    });
  };

  var handleShinyInput = function(el, opt, default_shiny_opt) {

    var id = shinyjqui.getId(el);

    if(id) {

      if(opt && opt.hasOwnProperty('shiny')) {
        // remove keys in default_shiny_opt that have duplicated input_suffix but with a input_handler.
        var suffix = Object.keys(default_shiny_opt);
        $.each(suffix, function(i, v){
          if($.inArray(v.replace(/:.+/, ''), Object.keys(opt.shiny)) >= 0) {
            delete default_shiny_opt[v];
          }
        });
        // overwrite default_shiny_opt with user provided opt.shiny
        $.extend(default_shiny_opt, opt.shiny);
        delete opt.shiny;
      }

      regShinyInput(el, id, default_shiny_opt);

    }

  };


  var evaluateJSExpressions = function(opt, idx) {
    $.each(idx, function( key, value ) {
        if(value === true && opt[key]) {
          opt[key] = eval("(" + opt[key] + ")");
        } else if(typeof value === 'object'){
          evaluateJSExpressions(opt[key], value);
        }
      });
  };

  var evalJS = function(option) {
    var idx = option._js_idx;
    if(idx && typeof idx === 'object') {
      evaluateJSExpressions(option, idx);
    }
    return(option);
  };

  // if the target el has "jqui-resizable-wrapper", return the wrapper
  var checkResizableWrapper = function(el) {
    if($(el).parent().hasClass("jqui-resizable-wrapper")) {
          el = $(el).parent().get(0);
    }
    return(el);
  };

  // Obtained from shiny init_shiny.js
  // Return true if the object or one of its ancestors in the DOM tree has
  // style='display:none'; otherwise return false.
  var isHidden = function(obj) {
    // null means we've hit the top of the tree. If width or height is
    // non-zero, then we know that no ancestor has display:none.
    if (obj === null || obj.offsetWidth !== 0 || obj.offsetHeight !== 0) {
      return false;
    } else if (getStyle(obj, 'display') === 'none') {
      return true;
    } else {
      return(isHidden(obj.parentNode));
    }
  };

  var interactions = {

    draggable : {

      enable : function(el, opt) {

        //el = getInputContainer(el);

        var func = function(event, ui) {
          return $(event.target).position();
        };

        var default_shiny_opt = {
          position : {
            dragcreate : func,
            drag : func
          },
          is_dragging : {
            dragcreate : function(event, ui) {return false;},
            dragstart : function(event, ui) {return true;},
            dragstop : function(event, ui) {return false;}
          }
        };

        el = checkResizableWrapper(el);

        handleShinyInput(el, opt, default_shiny_opt);

        $(el).draggable(opt);


      },

      disable : function(el) {

        el = getInputContainer(el);

        $(el).draggable('destroy');

      }

    },

    droppable : {

      enable : function(el, opt) {

        el = getInputContainer(el);

        var default_shiny_opt = {
          over : {
            dropcreate : function(event, ui){return [];},
            dropover : function(event, ui){return shinyjqui.getId(ui.draggable.get(0));}
          },
          drop : {
            dropcreate : function(event, ui){return [];},
            drop : function(event, ui){return shinyjqui.getId(ui.draggable.get(0));}
          },
          out : {
            dropcreate : function(event, ui){return [];},
            dropout : function(event, ui){return shinyjqui.getId(ui.draggable.get(0));}
          },
          dragging : {
            dropcreate : function(event, ui){return [];},
            dropactivate : function(event, ui){
            return shinyjqui.getId(ui.draggable.get(0));},
            dropdeactivate : function(event, ui){return [];}
          },
          dropped : {
            dropcreate : function(event, ui){
              $(event.target).data("shinyjqui_droppedIds", []);
              return [];
            },
            drop : function(event, ui){
              var current_ids = $(event.target).data("shinyjqui_droppedIds");
              var new_id = shinyjqui.getId(ui.draggable.get(0));
              if($.inArray(new_id, current_ids) == -1) current_ids.push(new_id);
              $(event.target).data("shinyjqui_droppedIds", current_ids);
              return current_ids;
            },
            dropout : function(event, ui){
              var current_ids = $(event.target).data("shinyjqui_droppedIds");
              var out_id = shinyjqui.getId(ui.draggable.get(0));
              current_ids.splice($.inArray(out_id, current_ids),1);
              $(event.target).data("shinyjqui_droppedIds", current_ids);
              return current_ids;
            }
          }
        };

        el = checkResizableWrapper(el);

        handleShinyInput(el, opt, default_shiny_opt);

        $(el).droppable(opt);


      },

      disable : function(el) {

        el = getInputContainer(el);

        $(el).droppable('destroy');

      }

    },

    resizable : {

      enable : function(el, opt) {

        if($(el).parent().hasClass('ui-resizable')) return;

        if(/action-button|html-widget-output|shiny-.+?-output/.test($(el).attr('class'))) {

          // Wrap the element when it is a shiny/htmlwidgets output, so that
          // the element's redraw on resizing won't remove the dragging handlers.
          // Shiny actionButton also needs wrapping. The resizable's internal
          // ui-wrapper is not working very well.
          var $wrapper = $('<div></div>')
            .outerWidth($(el).outerWidth() ? $(el).outerWidth() : '100%')
            .outerHeight($(el).outerHeight() ? $(el).outerHeight() : '100%')
            .css($(el).css(["top", "left"]))
            .addClass('jqui-resizable-wrapper');

          var wrapper = $(el)
            .wrap($wrapper)
            .outerWidth('100%')
            .outerHeight('100%')
            .css({top:"0px", left:"0px"})
            .parent().get(0);

          //var shinyjqui_options = $(el).data("shinyjqui_options");
          //$(wrapper).data("shinyjqui_options", {});
          // apply existed interaction options to wrapper, if any
          //$.each(shinyjqui_options, function(func, options) {
            //interactions[func].enable(wrapper, options);
            //interactions[func].disable(el);
            //$(wrapper).data("shinyjqui_options")[func] = options;
          //});
          //$(el).data("shinyjqui_options", {});


          // When applying resizable to element with other interactions already
          // initiated, the interaction options will first be transfered to
          // the wrapper, then be removed from the element

          var inter_funcs = ["draggable", "droppable", "selectable", "sortable"];
          $.each(inter_funcs, function(i, v){
            if($(el).is(".ui-" + v)) {
              var opt = $(el)[v]("option");
              $(wrapper)[v](opt);
              $(el)[v]("destroy");
            }
          });

          el = wrapper;

        }

        var default_shiny_opt = {
          size : {
            resizecreate : function(event, ui){
              return {
                width: $(event.target).width(),
                height: $(event.target).height()
              };
            },
            resize : function(event, ui){
              return ui.size;
            }
          },
          is_resizing : {
            resizecreate : function(event, ui){return false;},
            resizestart : function(event, ui){return true;},
            resizestop : function(event, ui){return false;}
          }
        };

        handleShinyInput(el, opt, default_shiny_opt);

        $(el).resizable(opt);

      },

      disable : function(el) {

        var $wrapper = $(el).parent('.ui-resizable');

        if($wrapper.length) {

          // do some more things when it is a shiny/htmlwidgets output.
          $wrapper.resizable('destroy');
          $(el)
            .outerWidth($wrapper.outerWidth())
            .outerHeight($wrapper.outerHeight())
            .insertAfter($wrapper);
          $wrapper.remove();

        } else {

          $(el).resizable('destroy');

        }

      }

    },

    selectable : {

      enable : function(el, opt) {

        var func = function(event, ui) {
          var $selected = $(event.target).children('.ui-selected');
          var html = $selected.map(function(i, e){return e.innerHTML;}).get();
          var ids = $selected.map(function(i, e){return shinyjqui.getId(e);}).get();
          return {'id': ids, 'html': html};
        };

        var default_shiny_opt = {
          'selected:shinyjqui.df' : {
            selectablecreate : func,
            selectablestop : func
          },
          is_selecting : {
            selectablecreate : function(event, ui) {return false;},
            selectablestart : function(event, ui) {return true;},
            selectablestop : function(event, ui) {return false;},
          }
        };

        el = checkResizableWrapper(el);

        handleShinyInput(el, opt, default_shiny_opt);

        $(el).selectable(opt);

      },

      disable : function(el) {

        $(el).selectable('destroy');

      }

    },

    sortable : {

      enable : function(el, opt) {

        var func = function(event, ui) {
            var $selected = $(event.target).children();
            var html = $selected.map(function(i, e){return e.innerHTML;}).get();
            var ids = $selected.map(function(i, e){return shinyjqui.getId(e);}).get();
            return {'id': ids, 'html': html};
          };

        var func_set = function(event, ui) {
          var $items = $(event.target).find('.ui-sortable-handle');
          $items.attr('jqui_sortable_idx', function(i, v){return i + 1});
          return $.map($(Array($items.length)),function(v, i){return i + 1});
        };

        var func_get = function(event, ui) {
          var idx = $(event.target)
            .sortable('toArray', {attribute:'jqui_sortable_idx'});
          return $.map(idx, function(v, i){return parseInt(v)});
        };

        var default_shiny_opt = {
          'order' : {
            sortcreate : func_set,
            sortupdate : func_get
          }
        };

        el = checkResizableWrapper(el);

        handleShinyInput(el, opt, default_shiny_opt);

        $(el).sortable(opt);

      },

      disable : function(el) {

        $(el).sortable('destroy');

      }

    }

  };

  var update_interactions = {

    resize : function(el, opt) {
      target = checkResizableWrapper(el);
      $(target).width(opt.width).height(opt.height);
      //$(el).data("shiny-output-binding").onResize();
      //$(el).trigger({
        //type: 'shiny:visualchange',
        //visible: !isHidden(el),
        //binding: $(el).data('shiny-output-binding')
      //});
    },

    drag : function(el, opt) {
      target = checkResizableWrapper(el);
      $(target).position(opt);
    },

    sort : function(el, opt) {
      var $items = $(el).children();
      $items.detach();
      $.each(opt.items, function(i, v) {
        $(el).append($items.get(v - 1));
      });
    }

  };


  return {

    // if el is or part of a shiny tag element, return the shiny id
    getId : function(el) {

      var id = $(el).attr('id');

      // tabsetInput
      if((!id) && $(el).hasClass('tabbable')) {
        id = $(el)
          .find('.shiny-bound-input')
          .attr('id');
      }

      // for shiny inputs
      if(!id) {
        id = $(el)
          .closest('.shiny-input-container')
          .find('.shiny-bound-input')
          .attr('id');
      }

      // for shiny output
      if(!id) {
        id = $(el)
          .closest('.shiny-bound-output')
          .attr('id');
      }

      // for shiny output that is wrapped with a resizable div
      if(!id) {
        id = $(el)
          .closest('.jqui-resizable-wrapper')
          .find('.shiny-bound-output')
          .attr('id');
      }

      return id ? id : '';
    },

    msgCallback : function(msg) {

      if(!msg.hasOwnProperty('selector')) {
          console.warn('No selector found');
          return;
        }
      var $els = $(msg.selector).map(function(i, e){
          return getInputContainer(e);
          //return e;
        });

      if(!msg.hasOwnProperty('method')) {
          console.warn('No method found');
          return;
        }
      var method = msg.method;

      if(!msg.hasOwnProperty('func')) {
          console.warn('No func found');
          return;
        }
      var func = msg.func;

      msg = evalJS(msg);

      if(method === 'interaction') {

          $els.removeClass(function(index, className){
            return (className.match (/(^|\s)jqui-interaction-\S+/g) || []).join(' ');
          });

          if(msg.switch === true) {

            $els.each(function(idx, el) {
              console.log('===================');
              console.log('ENABLE: ' + func);
              console.log('ELEMENT: ');
              console.log(el);
              console.log('OPTIONS: ');
              console.log(msg.options);
              console.log('===================');

              // create shinyjqui_options element data to store interaction options
              // these options may be used when resizable wrapper is introduced.
              //if(!$(el).data("shinyjqui_options")) {
                //$(el).data("shinyjqui_options", {})
              //}
              interactions[func].enable(el, msg.options);
              //$(el).data("shinyjqui_options")[func] = msg.options;
            });

          } else if(msg.switch === false) {

            $els.each(function(idx, el) {
              console.log('===================');
              console.log('DISABLE: ' + func);
              console.log('ELEMENT: ');
              console.log(el);
              console.log('===================');

              //if(!$(el).data("shinyjqui_options")) {
                //$(el).data("shinyjqui_options", {})
              //}

              interactions[func].disable(el);
              //delete $(el).data("shinyjqui_options")[func];
            });

          } else {

            console.warn('Invalid switch: ' + msg.switch);

          }

      } else if(method === 'update_interaction') {

        $els.each(function(idx, el) {
          console.log('===================');
          console.log('ENABLE: ' + func);
          console.log('ELEMENT: ');
          console.log(el);
          console.log('OPTIONS: ');
          console.log(msg.options);
          console.log('===================');

          update_interactions[func](el, msg.options);
        })

      } else if(method === 'effect') {

          if(!msg.hasOwnProperty('effect')) {
            console.warn('No effect found. Action abort.');
            return;
          }

          if(msg.effect === 'transfer' && (func === 'hide' || func === 'show' || func === 'toggle')) {
            console.warn('The transfer effect cannot be used in hide/show. Action abort.');
            return;
          }
          $els[func](msg.effect, msg.options, msg.duration, msg.complete);

      } else if(method === 'class') {

          if(func === 'add' || func === 'remove') {

            if(!msg.hasOwnProperty('className')) {
              console.warn('No className found');
              return;
            }
            $els[func + 'Class'](msg.className,
                                 msg.duration,
                                 msg.easing,
                                 msg.complete);

          } else if(func === 'switch') {

            if(!msg.hasOwnProperty('removeClassName')) {
              console.warn('No removeClassName found');
              return;
            }
            if(!msg.hasOwnProperty('addClassName')) {
              console.warn('No addClassName found');
              return;
            }
            $els[func + 'Class'](msg.removeClassName,
                                 msg.addClassName,
                                 msg.duration,
                                 msg.easing,
                                 msg.complete);

          } else {

            console.warn('Invalid func: ' + msg.func);

          }

      } else {

          console.warn('Invalid method: ' + msg.method);

        }

    },

    init : function() {
      Shiny.addCustomMessageHandler('shinyjqui', shinyjqui.msgCallback);
    }

  };

}();

$(function(){ shinyjqui.init(); });
