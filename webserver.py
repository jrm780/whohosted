import tornado.ioloop
import tornado.web
import os

class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.render('hosted.html')

def make_app():
    settings = {
        'debug': True,
        'static_path': os.path.join(os.path.dirname(__file__), 'static')
    }
    
    handlers = [
        (r'/', MainHandler),
    ]
    return tornado.web.Application(handlers, **settings)

if __name__ == "__main__":
    app = make_app()
    app.listen(8888)
    tornado.ioloop.IOLoop.current().start()