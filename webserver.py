import tornado.ioloop
import tornado.web as web
import os

class MainHandler(web.RequestHandler):
    def get(self):
        self.render('hosted.html')

def make_app():
    settings = {
        'debug': True,
        'static_path': os.path.join(os.path.dirname(__file__), 'static')
    }
    
    main_handlers = [
        (r'/.*', MainHandler),
        (r'.*', web.RedirectHandler, {'url': '/'})
    ]
    
    app = web.Application(main_handlers, **settings)
    return app

if __name__ == "__main__":
    app = make_app()
    app.listen(8888)
    tornado.ioloop.IOLoop.current().start()